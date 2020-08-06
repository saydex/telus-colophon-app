const { pool } = require('./connection')

exports.repositories = (string, installations, limit = 25, offset = 0) => {
  // cast ids to strings
 const  installation = installations.map(String)

  const query = 'SELECT COUNT(*) OVER() AS total, * FROM repositories WHERE (org LIKE $1 OR name LIKE $1 OR colophon ->> \'contacts\' LIKE $1) AND installation = ANY($2) LIMIT $3 OFFSET $4'

  return pool.query(query, [`%${string}%`, installation, limit, Math.abs(offset)])
}
