const Sequelize = require("sequelize");
const Database = require("./database");
const Users = Database.db.define("users", {
  username: Sequelize.STRING,
  tickets: Sequelize.INTEGER,
  userid: Sequelize.INTEGER,
  wins: Sequelize.INTEGER,
  losses: Sequelize.INTEGER
});

Users.sync();
module.exports = Users;
