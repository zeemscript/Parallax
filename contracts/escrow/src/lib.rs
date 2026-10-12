//! Parallax bounty escrow.
//!
//! One bounty per GitHub issue. A maintainer funds it, the tokens sit in this
//! contract, and they are released to the assigned contributor when the pull
//! request merges — or refunded to the maintainer if the issue is withdrawn.
//! Every release emits a `receipt` event, which is the contributor's public
//! record of the payout.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    /// Funded and waiting for, or being worked on by, an assignee.
    Open,
    /// Released to the assignee. Terminal.
    Paid,
    /// Returned to the maintainer. Terminal.
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bounty {
    pub maintainer: Address,
    /// GitHub `owner/name` of the repository.
    pub repo: String,
    /// GitHub issue number.
    pub issue: u32,
    pub amount: i128,
    pub assignee: Option<Address>,
    pub status: Status,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    NotFound = 2,
    NotOpen = 3,
    NotAssigned = 4,
    AlreadyFunded = 5,
    SelfAssign = 6,
}

#[contracttype]
enum Key {
    /// Address of the token every bounty is paid in (USDC's Stellar Asset Contract).
    Token,
    /// Last bounty id handed out.
    Counter,
    Bounty(u64),
    /// Guards against funding the same issue twice while one is still open.
    Issue(String, u32),
}

/// Emitted when a bounty is funded.
#[contractevent(topics = ["funded"])]
pub struct Funded {
    #[topic]
    pub id: u64,
    pub repo: String,
    pub issue: u32,
    pub amount: i128,
}

/// Emitted when a maintainer assigns or clears the assignee.
#[contractevent(topics = ["assigned"])]
pub struct Assigned {
    #[topic]
    pub id: u64,
    pub assignee: Option<Address>,
}

/// The contributor's receipt: emitted when a bounty is released on merge.
#[contractevent(topics = ["receipt"])]
pub struct Receipt {
    #[topic]
    pub id: u64,
    #[topic]
    pub contributor: Address,
    pub repo: String,
    pub issue: u32,
    pub pull_request: String,
    pub amount: i128,
}

/// Emitted when an open bounty is returned to its maintainer.
#[contractevent(topics = ["refunded"])]
pub struct Refunded {
    #[topic]
    pub id: u64,
    pub amount: i128,
}

/// Bounties can stay open for weeks, so keep their entries alive for roughly a year.
const BUMP_THRESHOLD: u32 = 518_400; // ~30 days of 5s ledgers
const BUMP_TO: u32 = 6_307_200; // ~365 days

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    /// Set the token bounties are paid in. Runs once, at deploy.
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&Key::Token, &token);
        env.storage().instance().set(&Key::Counter, &0u64);
    }

    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&Key::Token).unwrap()
    }

    /// Lock `amount` from the maintainer against one issue. Returns the bounty id.
    pub fn fund(
        env: Env,
        maintainer: Address,
        repo: String,
        issue: u32,
        amount: i128,
    ) -> Result<u64, Error> {
        maintainer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let issue_key = Key::Issue(repo.clone(), issue);
        if env.storage().persistent().has(&issue_key) {
            return Err(Error::AlreadyFunded);
        }

        token::Client::new(&env, &Self::token(env.clone())).transfer(
            &maintainer,
            env.current_contract_address(),
            &amount,
        );

        let id: u64 = env
            .storage()
            .instance()
            .get::<_, u64>(&Key::Counter)
            .unwrap()
            + 1;
        env.storage().instance().set(&Key::Counter, &id);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        let bounty = Bounty {
            maintainer,
            repo: repo.clone(),
            issue,
            amount,
            assignee: None,
            status: Status::Open,
        };
        Self::save(&env, id, &bounty);
        env.storage().persistent().set(&issue_key, &id);
        env.storage()
            .persistent()
            .extend_ttl(&issue_key, BUMP_THRESHOLD, BUMP_TO);

        Funded {
            id,
            repo,
            issue,
            amount,
        }
        .publish(&env);
        Ok(id)
    }

    /// Assign the contributor who will be paid on release, or clear with `None`.
    pub fn assign(env: Env, id: u64, assignee: Option<Address>) -> Result<(), Error> {
        let mut bounty = Self::open_bounty(&env, id)?;
        bounty.maintainer.require_auth();
        if assignee.as_ref() == Some(&bounty.maintainer) {
            return Err(Error::SelfAssign);
        }
        bounty.assignee = assignee.clone();
        Self::save(&env, id, &bounty);
        Assigned { id, assignee }.publish(&env);
        Ok(())
    }

    /// Pay the assignee. Called by the maintainer when the pull request merges.
    pub fn release(env: Env, id: u64, pull_request: String) -> Result<(), Error> {
        let mut bounty = Self::open_bounty(&env, id)?;
        bounty.maintainer.require_auth();
        let contributor = bounty.assignee.clone().ok_or(Error::NotAssigned)?;

        // State changes before the transfer, so a failed transfer reverts both.
        bounty.status = Status::Paid;
        Self::save(&env, id, &bounty);
        env.storage()
            .persistent()
            .remove(&Key::Issue(bounty.repo.clone(), bounty.issue));

        token::Client::new(&env, &Self::token(env.clone())).transfer(
            &env.current_contract_address(),
            &contributor,
            &bounty.amount,
        );

        Receipt {
            id,
            contributor,
            repo: bounty.repo,
            issue: bounty.issue,
            pull_request,
            amount: bounty.amount,
        }
        .publish(&env);
        Ok(())
    }

    /// Return an open bounty to its maintainer.
    pub fn refund(env: Env, id: u64) -> Result<(), Error> {
        let mut bounty = Self::open_bounty(&env, id)?;
        bounty.maintainer.require_auth();

        bounty.status = Status::Refunded;
        Self::save(&env, id, &bounty);
        env.storage()
            .persistent()
            .remove(&Key::Issue(bounty.repo.clone(), bounty.issue));

        token::Client::new(&env, &Self::token(env.clone())).transfer(
            &env.current_contract_address(),
            &bounty.maintainer,
            &bounty.amount,
        );

        Refunded {
            id,
            amount: bounty.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get(env: Env, id: u64) -> Result<Bounty, Error> {
        env.storage()
            .persistent()
            .get(&Key::Bounty(id))
            .ok_or(Error::NotFound)
    }

    /// Id of the open bounty on an issue, if there is one.
    pub fn bounty_for(env: Env, repo: String, issue: u32) -> Option<u64> {
        env.storage().persistent().get(&Key::Issue(repo, issue))
    }

    fn open_bounty(env: &Env, id: u64) -> Result<Bounty, Error> {
        let bounty: Bounty = env
            .storage()
            .persistent()
            .get(&Key::Bounty(id))
            .ok_or(Error::NotFound)?;
        if bounty.status != Status::Open {
            return Err(Error::NotOpen);
        }
        Ok(bounty)
    }

    fn save(env: &Env, id: u64, bounty: &Bounty) {
        let key = Key::Bounty(id);
        env.storage().persistent().set(&key, bounty);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
    }
}

#[cfg(test)]
mod test;
