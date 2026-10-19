extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, Event as _, String,
};

struct Setup<'a> {
    env: Env,
    escrow: EscrowClient<'a>,
    usdc: TokenClient<'a>,
    maintainer: Address,
    contributor: Address,
    repo: String,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let maintainer = Address::generate(&env);
    StellarAssetClient::new(&env, &sac.address()).mint(&maintainer, &10_000);

    let id = env.register(Escrow, (sac.address(),));
    Setup {
        escrow: EscrowClient::new(&env, &id),
        usdc: TokenClient::new(&env, &sac.address()),
        contributor: Address::generate(&env),
        repo: String::from_str(&env, "stellar/stellar-cli"),
        maintainer,
        env,
    }
}

#[test]
fn fund_locks_tokens_in_the_contract() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);

    assert_eq!(id, 1);
    assert_eq!(s.usdc.balance(&s.maintainer), 9_100);
    assert_eq!(s.usdc.balance(&s.escrow.address), 900);
    let bounty = s.escrow.get(&id);
    assert_eq!(bounty.status, Status::Open);
    assert_eq!(bounty.assignee, None);
    assert_eq!(s.escrow.bounty_for(&s.repo, &842), Some(id));
}

#[test]
fn release_pays_the_assignee_and_emits_a_receipt() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    s.escrow.assign(&id, &Some(s.contributor.clone()));
    let pr = String::from_str(&s.env, "https://github.com/stellar/stellar-cli/pull/1234");
    s.escrow.release(&id, &pr);

    // Events only cover the last invocation, so check the receipt before any further calls.
    let receipt = Receipt {
        id,
        contributor: s.contributor.clone(),
        repo: s.repo.clone(),
        issue: 842,
        pull_request: pr,
        amount: 900,
    };
    let events = s.env.events().all();
    assert!(events
        .events()
        .contains(&receipt.to_xdr(&s.env, &s.escrow.address)));

    assert_eq!(s.usdc.balance(&s.contributor), 900);
    assert_eq!(s.usdc.balance(&s.escrow.address), 0);
    assert_eq!(s.escrow.get(&id).status, Status::Paid);
    assert_eq!(s.escrow.bounty_for(&s.repo, &842), None);
}

#[test]
fn refund_returns_tokens_to_the_maintainer() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    s.escrow.refund(&id);

    assert_eq!(s.usdc.balance(&s.maintainer), 10_000);
    assert_eq!(s.escrow.get(&id).status, Status::Refunded);
    // The issue can be funded again once the old bounty is closed.
    assert_eq!(s.escrow.fund(&s.maintainer, &s.repo, &842, &500), 2);
}

#[test]
fn release_requires_an_assignee() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    let pr = String::from_str(&s.env, "https://github.com/stellar/stellar-cli/pull/1");
    assert_eq!(s.escrow.try_release(&id, &pr), Err(Ok(Error::NotAssigned)));
}

#[test]
fn maintainer_cannot_assign_bounty_to_themselves() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);

    assert_eq!(
        s.escrow.try_assign(&id, &Some(s.maintainer.clone())),
        Err(Ok(Error::SelfAssign))
    );
    assert_eq!(s.escrow.get(&id).assignee, None);
}

#[test]
fn maintainer_can_clear_an_assignee() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    s.escrow.assign(&id, &Some(s.contributor.clone()));
    s.escrow.assign(&id, &None);

    assert_eq!(s.escrow.get(&id).assignee, None);
}

#[test]
fn closed_bounties_cannot_be_paid_twice() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    s.escrow.assign(&id, &Some(s.contributor.clone()));
    let pr = String::from_str(&s.env, "https://github.com/stellar/stellar-cli/pull/1");
    s.escrow.release(&id, &pr);

    assert_eq!(s.escrow.try_release(&id, &pr), Err(Ok(Error::NotOpen)));
    assert_eq!(s.escrow.try_refund(&id), Err(Ok(Error::NotOpen)));
    assert_eq!(s.escrow.try_assign(&id, &None), Err(Ok(Error::NotOpen)));
}

#[test]
fn an_issue_cannot_hold_two_open_bounties() {
    let s = setup();
    s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    assert_eq!(
        s.escrow.try_fund(&s.maintainer, &s.repo, &842, &100),
        Err(Ok(Error::AlreadyFunded))
    );
}

#[test]
fn amount_must_be_positive() {
    let s = setup();
    assert_eq!(
        s.escrow.try_fund(&s.maintainer, &s.repo, &842, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        s.escrow.try_fund(&s.maintainer, &s.repo, &842, &-5),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn unknown_bounty_is_not_found() {
    let s = setup();
    assert_eq!(s.escrow.try_get(&99), Err(Ok(Error::NotFound)));
}

#[test]
fn only_the_maintainer_can_move_funds() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    s.escrow.assign(&id, &Some(s.contributor.clone()));

    // Every state change after funding is authorised by the maintainer, never the assignee.
    let auths = s.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, s.maintainer);
}

#[test]
#[should_panic]
fn release_without_maintainer_auth_fails() {
    let s = setup();
    let id = s.escrow.fund(&s.maintainer, &s.repo, &842, &900);
    s.escrow.assign(&id, &Some(s.contributor.clone()));

    s.env.set_auths(&[]);
    s.escrow.release(
        &id,
        &String::from_str(&s.env, "https://github.com/stellar/stellar-cli/pull/1"),
    );
}
