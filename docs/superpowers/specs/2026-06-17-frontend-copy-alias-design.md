# Frontend Copy Alias Design

**Goal:** Remove all user-visible frontend copy that mentions `网易云`, replace all user-visible `解灰` mentions with neutral wording, and leave internal code identifiers and backend behavior unchanged.

## Problem

The current frontend presents provider-specific and domain-specific wording in visible UI copy. The requested change is to keep the product behavior the same, but update the wording so users no longer see `网易云`, and see neutral wording instead of `解灰`.

## Proposed Approach

1. Update user-visible strings in `frontend/index.html` and `frontend/js/*.js`.
2. Rewrite every visible `网易云` mention so the provider name is removed while the copy still reads naturally.
3. Replace every visible `解灰` mention with `音源补全`.
4. Leave internal identifiers such as `netease`, `NCM`, API field names, and source keys unchanged.

## Constraints

- Only edit the frontend source under `frontend/`.
- Do not modify packaged build output under `dist/`.
- Do not change application behavior, request flow, or data structures.
- Only replace strings that are user-visible in the frontend UI or frontend-thrown messages.

## Verification

- Search `frontend/` for remaining visible copy containing `网易云` or `解灰`.
- Confirm `网易云` no longer appears in user-visible frontend copy and `解灰` has been rewritten to `音源补全`.
- Ensure no internal program identifiers were renamed as part of the copy-only change.
