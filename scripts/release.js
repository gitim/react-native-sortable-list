const {promisify} = require('util');

const execa = require('execa');
const parse = require('git-url-parse');
const semver = require('semver');
const rimraf = promisify(require('rimraf'));
const Listr = require('listr');

const pkg = require('../package');

const allowedTypes = [
    'major',
    'minor',
    'patch'
];
const release = process.argv[2];
const name = pkg.name;
const version = semver.inc(pkg.version, release);
const tasks = new Listr([
    {
        task: () => execa.stdout('git', ['remote', 'get-url', 'origin']).then((result) => {
            const pkgUrlParsed = parse(pkg.repository.url);
            const gitUrlParsed = parse(result);
            const pkgUrl = pkgUrlParsed.resource + pkgUrlParsed.pathname;
            const gitUrl = gitUrlParsed.resource + gitUrlParsed.pathname;

            if (pkgUrl !== gitUrl) {
                throw new Error('Cannot publish from a fork. Please clone source repository directly or ensure that the `package.json` file has a `repository.url` set.');
            }
        }),
        title: 'Not publishing from fork'
    },
    {
        task: () => execa.stdout('git', ['symbolic-ref', '--short', 'HEAD']).then((result) => {
            if (result !== 'master') {
                throw new Error('Not on `master` branch. Please switch to `master` branch before publishing.');
            }
        }),
        title: 'On `master` branch'
    },
    {
        task: () => execa.stdout('git', ['status', '--porcelain']).then((result) => {
            if (result !== '') {
                throw new Error('Unclean working tree. Please commit or stash changes first.');
            }
        }),
        title: 'No uncommitted changes'
    },
    {
        task: () => execa.stdout('git', ['rev-list', '--count', '--left-only', '@{u}...HEAD']).then((result) => {
            if (result !== '0') {
                throw new Error('Remote has changes you do not have locally. Please pull changes.');
            }
        }),
        title: 'Have latest remote changes'
    },
    {
        task: () => rimraf('node_modules'),
        title: 'Removing `node_modules`'
    },
    {
        task: () => execa('yarn'),
        title: 'Installing dependencies using yarn'
    },
    {
        enabled: () => pkg.scripts.test !== undefined,
        task: () => execa('yarn', ['test']),
        title: 'Running tests'
    },
    {
        enabled: () => pkg.scripts.build !== undefined,
        task: () => execa('yarn', ['build']),
        title: 'Building assets'
    },
    {
        task: () => execa('yarn', ['publish', '--access', 'restricted', '--new-version', version]),
        title: 'Publishing to npm registry'
    },
    {
        task: () => execa('git', ['push', '--follow-tags']),
        title: 'Pushing tags'
    }
]);

if (!allowedTypes.includes(release)) {
    throw new Error('Please specify a valid release type by passing in `major`, `minor`, or `patch`, ie. `yarn release patch`.');
}

console.log(`Will bump ${pkg.name} from ${pkg.version} to ${version}.`); // eslint-disable-line no-console

tasks.run()
    .then(() => console.log(`${name} ${version} published! 🎉`)) // eslint-disable-line no-console
    .catch((error) => {
        console.error(error); // eslint-disable-line no-console
    });
