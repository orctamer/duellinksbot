const Sequelize = require('sequelize')
const Database = require('./database')
const Users = Database.db.define('users', {
    username: Sequelize.STRING,
    tickets: Sequelize.INTEGER,
    userid: Sequelize.INTEGER,
    email: Sequelize.STRING,
    wins: Sequelize.INTEGER,
    losses: Sequelize.INTEGER
})

Users.sync()
module.exports = Users