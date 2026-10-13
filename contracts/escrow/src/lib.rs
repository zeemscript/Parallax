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

/// Lifecycle state of an escrow bounty.
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

/// On-chain record for a single GitHub issue bounty held in escrow.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bounty {
    /// Stellar address of the maintainer who funded and controls the bounty.
    pub maintainer: Address,
    /// GitHub `owner/name` of the repository.
    pub repo: String,
    /// GitHub issue number.
    pub issue: u32,
    /// Locked token amount in the payment token's smallest unit (7-decimal stroops for USDC).
    pub amount: i128,
    /// Optional contributor address assigned to receive the payout on [`Escrow::release`].
    pub assignee: Option<Address>,
    /// Current lifecycle state (`Open`, `Paid`, or `Refunded`).
    pub status: Status,
}

/// Errors returned by [`Escrow`] entry points.
#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// The bounty amount passed to [`Escrow::fund`] is zero or negative (`<= 0`).
    InvalidAmount = 1,
    /// No bounty exists in persistent storage with the given `id`.
    NotFound = 2,
    /// The bounty is already [`Status::Paid`] or [`Status::Refunded`] and can no longer be modified.
    NotOpen = 3,
    /// [`Escrow::release`] was called on an open bounty before an assignee was set via [`Escrow::assign`].
    NotAssigned = 4,
    /// The `repo#issue` pair already has an open bounty in escrow.
    AlreadyFunded = 5,
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

/// Per-issue bounty escrow contract for Parallax on Stellar.
#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    /// Initialize the escrow contract with the payment `token` address and reset the bounty counter.
    ///
    /// - **Authorization**: Runs once at contract deployment (authorized by the deployer).
    /// - **Errors**: None.
    /// - **Events**: None.
    ///
    /// # Examples
    ///
    /// ```rust
    /// let contract_id = env.register(Escrow, (usdc_sac_address,));
    /// let client = EscrowClient::new(&env, &contract_id);
    /// ```
    pub fn __constructor(env: Env, token: Address) {
        env.storage().instance().set(&Key::Token, &token);
        env.storage().instance().set(&Key::Counter, &0u64);
    }

    /// Return the Stellar Asset Contract address of the payment token configured at deployment.
    ///
    /// - **Authorization**: None (read-only).
    /// - **Errors**: None (panics only if called on an uninitialized contract instance).
    /// - **Events**: None.
    ///
    /// # Examples
    ///
    /// ```rust
    /// let payment_token = client.token();
    /// ```
    pub fn token(env: Env) -> Address {
        env.storage().instance().get(&Key::Token).unwrap()
    }

    /// Lock `amount` of the payment token from `maintainer` into escrow for `repo#issue` and
    /// return the newly allocated sequential bounty `id`.
    ///
    /// Only one open bounty may exist per `(repo, issue)` at a time; once a bounty is released or
    /// refunded, the issue key is cleared and the issue can be funded again.
    ///
    /// - **Authorization**: Requires `maintainer.require_auth()` (both for this call and the
    ///   underlying token transfer into the contract).
    /// - **Errors**:
    ///   - [`Error::InvalidAmount`] if `amount <= 0`.
    ///   - [`Error::AlreadyFunded`] if `repo#issue` already has an [`Status::Open`] bounty.
    /// - **Events**: Emits [`Funded`] with topic `("funded", id)` and data `{ repo, issue, amount }`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// let repo = String::from_str(&env, "stellar/stellar-cli");
    /// let id = client.fund(&maintainer, &repo, &842, &900_0000000);
    /// assert_eq!(id, 1);
    /// ```
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

    /// Set or clear (`None`) the contributor address assigned to receive the bounty payout.
    ///
    /// - **Authorization**: Requires `bounty.maintainer.require_auth()`.
    /// - **Errors**:
    ///   - [`Error::NotFound`] if no bounty exists with `id`.
    ///   - [`Error::NotOpen`] if the bounty is already [`Status::Paid`] or [`Status::Refunded`].
    /// - **Events**: Emits [`Assigned`] with topic `("assigned", id)` and data `{ assignee }`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// client.assign(&id, &Some(contributor.clone()));
    /// // Clear the assignee if the contributor withdraws:
    /// client.assign(&id, &None);
    /// ```
    pub fn assign(env: Env, id: u64, assignee: Option<Address>) -> Result<(), Error> {
        let mut bounty = Self::open_bounty(&env, id)?;
        bounty.maintainer.require_auth();
        bounty.assignee = assignee.clone();
        Self::save(&env, id, &bounty);
        Assigned { id, assignee }.publish(&env);
        Ok(())
    }

    /// Release an open bounty's locked tokens to its assigned contributor and emit an on-chain
    /// [`Receipt`] event linking the payout to `pull_request`.
    ///
    /// Marks the bounty [`Status::Paid`] and clears the `(repo, issue)` lock before transferring
    /// tokens out of escrow.
    ///
    /// - **Authorization**: Requires `bounty.maintainer.require_auth()`.
    /// - **Errors**:
    ///   - [`Error::NotFound`] if no bounty exists with `id`.
    ///   - [`Error::NotOpen`] if the bounty is already [`Status::Paid`] or [`Status::Refunded`].
    ///   - [`Error::NotAssigned`] if `bounty.assignee` is `None`.
    /// - **Events**: Emits [`Receipt`] with topics `("receipt", id, contributor)` and data
    ///   `{ repo, issue, pull_request, amount }`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// client.assign(&id, &Some(contributor.clone()));
    /// let pr = String::from_str(&env, "https://github.com/stellar/stellar-cli/pull/1234");
    /// client.release(&id, &pr);
    /// ```
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

    /// Refund an open bounty's locked tokens back to the maintainer who funded it.
    ///
    /// Marks the bounty [`Status::Refunded`] and removes the `(repo, issue)` lock so the issue can
    /// be funded again in the future if needed.
    ///
    /// - **Authorization**: Requires `bounty.maintainer.require_auth()`.
    /// - **Errors**:
    ///   - [`Error::NotFound`] if no bounty exists with `id`.
    ///   - [`Error::NotOpen`] if the bounty is already [`Status::Paid`] or [`Status::Refunded`].
    /// - **Events**: Emits [`Refunded`] with topic `("refunded", id)` and data `{ amount }`.
    ///
    /// # Examples
    ///
    /// ```rust
    /// client.refund(&id);
    /// assert_eq!(client.get(&id).status, Status::Refunded);
    /// ```
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

    /// Read the [`Bounty`] record for `id` from persistent storage.
    ///
    /// - **Authorization**: None (read-only).
    /// - **Errors**:
    ///   - [`Error::NotFound`] if no bounty exists with `id`.
    /// - **Events**: None.
    ///
    /// # Examples
    ///
    /// ```rust
    /// let bounty = client.get(&id);
    /// assert_eq!(bounty.status, Status::Open);
    /// ```
    pub fn get(env: Env, id: u64) -> Result<Bounty, Error> {
        env.storage()
            .persistent()
            .get(&Key::Bounty(id))
            .ok_or(Error::NotFound)
    }

    /// Return the bounty `id` of the currently [`Status::Open`] bounty on `(repo, issue)`, or
    /// `None` if the issue has no open bounty.
    ///
    /// - **Authorization**: None (read-only).
    /// - **Errors**: None.
    /// - **Events**: None.
    ///
    /// # Examples
    ///
    /// ```rust
    /// let open_id = client.bounty_for(&repo, &842);
    /// assert_eq!(open_id, Some(id));
    /// ```
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
