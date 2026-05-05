# What Fantasy Casino Is and Is Not

This document defines the project in precise terms so the experiment does not drift into vague ambition or accidental scope creep.

## What it is

Fantasy Casino is a local-first engineering stress test built around a casino-shaped Rails system. Its purpose is to test whether autonomous agents on a personal laptop can safely plan, implement, verify, document, and explain complex work.

It is also a visibility platform. The project should create useful technical artifacts, operational lessons, and repeatable narratives that demonstrate engineering maturity, risk awareness, and practical AI usage.

It is a laboratory for measuring speed, cost, quality, observability, security, and reuse. The output should include real code, real tests, real traces, real dashboards, and real postmortems.

## What it is not

Fantasy Casino is not a claim that local models are always better than frontier models.

It is not a real-money gambling product.

It is not a production compliance rollout.

It is not a promise that the agent will be right more often than a human in every case.

It is not a search for maximum model hype. It is a search for maximum useful autonomy under bounded conditions.

## Why the casino shape exists

The casino domain is useful because it naturally includes transactional state, auditability, admin workflows, risk controls, and a need for reliable changes. Those properties force the agentic system to prove that it can handle real engineering concerns instead of only generating text or toy CRUD.

## Minimum domain surface

The first useful version should include user accounts, balances, transactions, rounds, bets, settlements, audit logs, admin views, basic reporting, and event traces. This is enough to test the system without turning the project into a real gambling operation.

## Core promise

The project should produce an honest answer to a single question: can a local, sandboxed, observable, reusable, agent-driven Rails stack produce meaningful software safely enough to be worth scaling?
