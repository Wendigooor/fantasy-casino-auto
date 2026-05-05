# Bootstrap Checklist: Day 1

## Goal

Get the smallest safe local agent loop running on the laptop.

This is the bootstrap for `Fantasy Casino as Agentic Stress Test`.

## Before you start

- confirm the repo opens locally
- confirm you can edit files in the workspace
- confirm you know where Telegram notifications will go
- confirm the no-delete rule is active
- confirm the secret manager path is defined

## Step 1: Prepare the workspace

- create separate folders for active work, snapshots, and quarantine
- make sure the agent does not write directly into stable source folders
- define a default rollback snapshot path

## Step 2: Validate the model runtime

- pick one local coding model as the primary model
- make sure the runtime starts reliably on the laptop
- measure first-token latency and basic throughput
- keep the first test intentionally small

## Step 3: Wire the control surface

- connect Telegram as the notification channel
- ensure the agent can send task status updates
- ensure the agent can request approval before risky actions

## Step 4: Add repo visibility

- index the repository tree
- map pages, research docs, and source files
- build a short summary of the current codebase
- store that summary as a durable artifact

## Step 5: Add safe editing

- allow file creation
- allow file updates
- replace deletion with quarantine moves
- preview diffs before finalizing

## Step 6: Add verification

- run a fast lint or validation command
- run at least one content or structure check
- record success and failure outputs

## Step 7: Add observability

- log session id
- log agent role
- log tokens and time
- log command results
- log patch summary

## Step 8: Run the first real task

Choose a low-risk task such as:

- update documentation
- fix a broken link
- add a glossary term
- improve a markdown structure

The first successful task should be boring.

## Day 1 exit criteria

- one local model works
- one agent loop works
- one Telegram update works
- one patch can be created safely
- one verification command runs
- one log record is written
