# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately
through the **Report a vulnerability** form on this repository's Security tab
(GitHub private vulnerability reporting). If that form is not available, open an
issue that says only "security — please contact me", with no details, and the
maintainer will get in touch.

Include the affected route or file, the steps to reproduce, and what an
attacker could gain. You can expect an acknowledgement within 7 days. Fixes are
deployed to the live site (https://aizyradar.cn) by the maintainer; there is no
bug bounty.

## Scope

In scope: the code in this repository and the public site it serves. The
internal workspace is not part of the public build — see
[`docs/security-boundary.md`](docs/security-boundary.md) for what is public
and what is not.

Out of scope: third-party services the site links to, and the content of the
articles it imports.

## Supported versions

Only the current `main` branch is supported.

---

中文：请不要为安全问题开公开 issue，通过仓库 Security 页的「Report a
vulnerability」私下报告；收到后 7 天内回复。只支持当前 `main` 分支。
