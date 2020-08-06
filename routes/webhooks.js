const WebhooksApi = require('@octokit/webhooks')
const db = require('../lib/db/')
const log = require('../lib/log')
const install = require('../lib/install')
const scan = require('../lib/scan/repo')

const webhooks = new WebhooksApi({ secret: process.env.GITHUB_WEBHOOK_SECRET })

// general log for all events
webhooks.on('*', ({ id, name, payload: { installation } }) => {
  log.info('%s:blue %s:green %s:gray', installation.id, name, id)
})

// installation added
webhooks.on('installation.created', ({ payload: { installation } }) => {
  // install & scan repositories
  install(installation)
})

// installation removed
webhooks.on('installation.deleted', ({ payload: { installation } }) => {
  db.installation.remove(installation.id)
})

// installation updated (repositories added)
webhooks.on('installation_repositories.added', ({ payload: { installation, repositories_added } }) => { // eslint-disable-line camelcase
  log.info('%s:blue adding %d:cyan repositories', installation.id, repositories_added.length)

  repositories_added.map(repository => {
   return db.repository.add(installation.id, repository)
  })
})

// installation updated (repos removed)
webhooks.on('installation_repositories.removed', ({ payload: { installation, repositories_removed } }) => { // eslint-disable-line camelcase
  log.info('%s:blue removing %d:cyan repositories', installation.id, repositories_removed.length)

  repositories_removed.map(repo => {
   return db.repository.remove(installation.id, repo.id)
  })
})

webhooks.on('repository.created', ({ payload: { installation, repository } }) => {
  log.info('%s:blue adding %s:cyan', installation.id, repository.full_name)

  db.repository.add(installation.id, repository)
})

webhooks.on('repository.deleted', ({ payload: { installation, repository } }) => {
  log.info('%s:blue removing %s:cyan', installation.id, repository.full_name)

  db.repository.remove(installation.id, repository.id)
})

webhooks.on('push', ({ payload }) => {
  const { installation, repository, ref, commits } = payload

  // is this the default branch?
  const defaultBranch = ref === `refs/heads/${repository.default_branch}`

  // exit early
  if (!defaultBranch) {
    log.info('%s:blue skipping %s:yellow/%s:yellow (changes on non-default branch)', installation.id, repository.owner.login, repository.name)

    return
  }

  // confirm if this commit is applied to the default branch
  const colophonModified = commits.find(({ added, modified }) => {
    return added.includes('.colophon.yml') || modified.includes('.colophon.yml')
  })

  if (!colophonModified) {
    log.info('%s:blue skipping %s:yellow/%s:yellow (no change to .colophon.yml)', installation.id, repository.owner.login, repository.name)

    return
  }

  // initiate scan
  log.info('%s:blue change detected on %s:yellow/%s:yellow', installation.id, repository.owner.login, repository.name)

  scan(installation.id, repository.owner.login, repository.name)
})

module.exports = webhooks.middleware
