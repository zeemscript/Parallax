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

#[derive(Clone, Debug, Eq, PartialEq)]
struct ModelBounty {
    id: u64,
    maintainer_idx: usize,
    issue: u32,
    amount: i128,
    assignee_idx: Option<usize>,
    status: Status,
}

fn next_u64(state: &mut u64) -> u64 {
    let mut x = *state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    *state = x;
    x
}

#[test]
fn tokens_are_conserved_across_random_call_sequences() {
    for seed in 1_u64..=8_u64 {
        let env = Env::default();
        env.mock_all_auths();

        let issuer = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(issuer);
        let sac_admin = StellarAssetClient::new(&env, &sac.address());
        let usdc = TokenClient::new(&env, &sac.address());

        let maintainers = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        let contributors = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        let initial_mint: i128 = 1_000_000;
        for m in &maintainers {
            sac_admin.mint(m, &initial_mint);
        }

        let contract_id = env.register(Escrow, (sac.address(),));
        let escrow = EscrowClient::new(&env, &contract_id);
        let repo = String::from_str(&env, "stellar/stellar-cli");
        let pr = String::from_str(&env, "https://github.com/stellar/stellar-cli/pull/42");

        let mut rng = seed * 0x9E37_79B9_7F4A_7C15;
        let mut model: std::vec::Vec<ModelBounty> = std::vec::Vec::new();
        let mut paid_count: std::collections::BTreeMap<u64, u32> =
            std::collections::BTreeMap::new();
        let mut total_funded: i128 = 0;
        let mut total_refunded: i128 = 0;
        let mut total_paid: i128 = 0;

        for _step in 0..80 {
            let op = next_u64(&mut rng) % 5;
            match op {
                0 => {
                    // Fund (including invalid amounts and duplicate open issues)
                    let m_idx = (next_u64(&mut rng) as usize) % maintainers.len();
                    let issue = ((next_u64(&mut rng) % 6) + 1) as u32;
                    let raw = (next_u64(&mut rng) % 700) as i128 - 100;
                    let has_open = model
                        .iter()
                        .any(|b| b.issue == issue && b.status == Status::Open);

                    let res = escrow.try_fund(&maintainers[m_idx], &repo, &issue, &raw);
                    if raw <= 0 {
                        assert_eq!(res, Err(Ok(Error::InvalidAmount)));
                    } else if has_open {
                        assert_eq!(res, Err(Ok(Error::AlreadyFunded)));
                    } else {
                        let new_id = (model.len() as u64) + 1;
                        assert_eq!(res, Ok(Ok(new_id)));
                        total_funded += raw;
                        model.push(ModelBounty {
                            id: new_id,
                            maintainer_idx: m_idx,
                            issue,
                            amount: raw,
                            assignee_idx: None,
                            status: Status::Open,
                        });
                    }
                }
                1 => {
                    // Assign or unassign (including unknown or closed ids)
                    let target_id = (next_u64(&mut rng) % ((model.len() as u64) + 2)) + 1;
                    let c_choice = next_u64(&mut rng) % (contributors.len() as u64 + 1);
                    let assignee_idx = if c_choice < contributors.len() as u64 {
                        Some(c_choice as usize)
                    } else {
                        None
                    };
                    let assignee_addr = assignee_idx.map(|i| contributors[i].clone());
                    let res = escrow.try_assign(&target_id, &assignee_addr);

                    match model.iter_mut().find(|b| b.id == target_id) {
                        None => assert_eq!(res, Err(Ok(Error::NotFound))),
                        Some(b) if b.status != Status::Open => {
                            assert_eq!(res, Err(Ok(Error::NotOpen)));
                        }
                        Some(b) => {
                            assert_eq!(res, Ok(Ok(())));
                            b.assignee_idx = assignee_idx;
                        }
                    }
                }
                2 => {
                    // Release (including unassigned, closed, or unknown ids)
                    let target_id = (next_u64(&mut rng) % ((model.len() as u64) + 2)) + 1;
                    let res = escrow.try_release(&target_id, &pr);

                    match model.iter_mut().find(|b| b.id == target_id) {
                        None => assert_eq!(res, Err(Ok(Error::NotFound))),
                        Some(b) if b.status != Status::Open => {
                            assert_eq!(res, Err(Ok(Error::NotOpen)));
                        }
                        Some(b) if b.assignee_idx.is_none() => {
                            assert_eq!(res, Err(Ok(Error::NotAssigned)));
                        }
                        Some(b) => {
                            assert_eq!(res, Ok(Ok(())));
                            b.status = Status::Paid;
                            total_paid += b.amount;
                            let count = paid_count.entry(b.id).or_insert(0);
                            *count += 1;
                            assert_eq!(*count, 1);
                        }
                    }
                }
                3 => {
                    // Refund (including closed or unknown ids)
                    let target_id = (next_u64(&mut rng) % ((model.len() as u64) + 2)) + 1;
                    let res = escrow.try_refund(&target_id);

                    match model.iter_mut().find(|b| b.id == target_id) {
                        None => assert_eq!(res, Err(Ok(Error::NotFound))),
                        Some(b) if b.status != Status::Open => {
                            assert_eq!(res, Err(Ok(Error::NotOpen)));
                        }
                        Some(b) => {
                            assert_eq!(res, Ok(Ok(())));
                            b.status = Status::Refunded;
                            total_refunded += b.amount;
                        }
                    }
                }
                _ => {
                    // Read state and verify unknown id returns NotFound
                    let target_id = (next_u64(&mut rng) % ((model.len() as u64) + 2)) + 1;
                    let res = escrow.try_get(&target_id);
                    if target_id > model.len() as u64 {
                        assert_eq!(res, Err(Ok(Error::NotFound)));
                    } else {
                        assert!(res.is_ok());
                    }
                }
            }

            // Invariant 1: contract balance equals sum of Open bounty amounts.
            let open_sum: i128 = model
                .iter()
                .filter(|b| b.status == Status::Open)
                .map(|b| b.amount)
                .sum();
            let contract_balance = usdc.balance(&escrow.address);
            assert_eq!(contract_balance, open_sum);

            // Invariant 2: tokens in escrow + tokens paid out == net funded tokens.
            assert_eq!(contract_balance + total_paid, total_funded - total_refunded);

            // Invariant 3: total tokens across all actors and escrow is conserved.
            let maintainer_sum: i128 = maintainers.iter().map(|m| usdc.balance(m)).sum();
            let contributor_sum: i128 = contributors.iter().map(|c| usdc.balance(c)).sum();
            assert_eq!(
                maintainer_sum + contributor_sum + contract_balance,
                initial_mint * (maintainers.len() as i128)
            );

            // Invariant 4: every recorded bounty matches on-chain state and closed bounties never mutate.
            for b in &model {
                let onchain = escrow.get(&b.id);
                assert_eq!(onchain.status, b.status);
                assert_eq!(onchain.amount, b.amount);
                assert_eq!(onchain.maintainer, maintainers[b.maintainer_idx]);
                assert_eq!(
                    onchain.assignee,
                    b.assignee_idx.map(|i| contributors[i].clone())
                );
            }
        }
    }
}
