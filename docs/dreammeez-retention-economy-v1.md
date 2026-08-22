# DreamMeez Retention Economy v1

The first retention loop is daily check-in streaks with explicit, predictable rewards. The user sees progress, the next threshold, and the reward before earning it. Rewards are limited discounts, not hidden pricing changes.

Thresholds:

- 7 consecutive days: 3% discount, 7-day validity.
- 14 consecutive days: 5% discount, 7-day validity.
- 30 consecutive days: 10% discount, 7-day validity.

A missed day resets the current streak to 1. Best streak remains permanent. Rechecking the same day is idempotent.

The design deliberately avoids fake scarcity, hidden odds and coercive loss framing. The objective is to make returning useful and identity-bearing without trapping the buyer.

Research basis: a June 2026 peer-reviewed study in the Journal of Retailing and Consumer Services reported that gamified loyalty can affect engagement and purchase behaviour and examined autonomy and fairness as part of the response mechanism. See DOI 10.1016/j.jretconser.2026.104834.
