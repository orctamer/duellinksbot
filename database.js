const Sequelize = require("sequelize");

const database = new Sequelize({
	logging: false,
	dialect: "sqlite",
	storage: "./database.sqlite"
});

class Database {
	static get db() {
		return database;
	}
	static get Models() {
		return {
			Users: require("./user")
		};
	}
}

module.exports = Database;
