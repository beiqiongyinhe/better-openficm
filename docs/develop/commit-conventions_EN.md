# Commit message conventions (Conventional Commits 1.0.0)

[简体中文](commit-conventions.md)

> Translation note: this is an English translation of this fork's docs/develop/commit-conventions.md.

This project follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

## Structure of a commit message

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- `type`, the `:` and the space after it are mandatory; `scope`, `!`, `body` and `footer` are all optional
- Apart from `BREAKING CHANGE`, which must stay upper case, the individual elements are case insensitive

## type

- Must start with a type prefix made up of a noun.
- The types defined by the specification (which must be used with these meanings):

  | type | meaning |
  | --- | --- |
  | `feat` | introduces a complete new feature |
  | `fix` | fixes a bug |
  | `build` | a change that affects the build system or external dependencies |
  | `chore` | miscellaneous changes; anything that does not belong to another type goes here |
  | `ci` | changes to CI configuration files and scripts |
  | `docs` | documentation changes |
  | `style` | formatting or style changes that do not affect the meaning of the code |
  | `refactor` | a change that neither fixes a bug nor adds a feature |
  | `perf` | a code change that improves performance |
  | `test` | adding or correcting tests |

## scope

- Optional; goes after the type and before the `:`, wrapped in parentheses
- Must be a noun describing some part of the code base, e.g. `fix(parser):`

## description

- Mandatory; comes straight after the colon and the space
- A short summary of the code change
- For bug-fix commits the expected shape is `<action><problem><result>`, for example "fix the problem where xxx caused xx"

## body

- Optional; starts on a blank line after the description
- Free-form; may contain any number of paragraphs separated by blank lines

## footer

- Optional; starts on a blank line after the body.
- Each footer is made of a token, a separator and a value:
  - the separator is `:<space>` or `<space>#`
  - spaces inside a token are replaced by `-`, e.g. `Acked-by` (this is what tells a footer apart from a multi-paragraph body)
- `BREAKING CHANGE` is the exception and may be used as a token as-is (keep it upper case); `BREAKING-CHANGE` and `BREAKING CHANGE` are synonyms

