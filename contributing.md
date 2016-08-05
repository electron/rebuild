# Contributing to electron-rebuild

:+1::tada: First off, thanks for taking the time to contribute! :tada::+1:

This project adheres to the Contributor Covenant [code of conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Please report unacceptable
behavior to electron@github.com.

The following is a set of guidelines for contributing to electron-rebuild.
These are just guidelines, not rules, use your best judgment and feel free to
propose changes to this document in a pull request.

## Submitting Issues

* You can create an issue [here](https://github.com/electron/electron-rebuild/issues/new),
but before doing that please read the notes below and include as many details as
possible with your report. If you can, please include:
  * The version of electron and electron-rebuild you are using
  * The operating system you are using
  * If applicable, what you were doing when the issue arose and what you
  expected to happen
* Other things that will help resolve your issue:
  * Screenshots and animated GIFs
  * Error output that appears in your terminal, dev tools or as an alert
  * Perform a [cursory search](https://github.com/electron/electron-rebuild/issues?utf8=✓&q=is%3Aissue+)
  to see if a similar issue has already been submitted

## Submitting Pull Requests

* Include screenshots and animated GIFs in your pull request whenever possible.
* Write documentation in [Markdown](https://daringfireball.net/projects/markdown).
* Use short, present tense commit messages. See [Commit Message Styleguide](#git-commit-messages).

## Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally
* When only changing documentation, include `[ci skip]` in the commit description

## Publishing to npm

This project has a generated changelog. This process could eventually be
automated, but for now there are some manual steps:

1. Edit `package.json`, setting `version` to the upcoming release number.
1. Run `npm run changelog`. This will update `changelog.md` and revert your `version` changes in `package.json`.
1. Verify that `changelog.md` looks right.
1. Commit changes: `git commit -m "update changelog"`
1. Create a git tag for the upcoming version using `npm version patch|minor|major -m "new stuff"`
1. `npm publish`
1. `git push origin master --follow-tags`
