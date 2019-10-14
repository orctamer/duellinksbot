const { Client } = require("discord.js");
const client = new Client();
const express = require("express");
const paypal = require("paypal-rest-sdk");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const session = require("express-session");
const path = require("path");
const bodyParser = require("body-parser");
const config = require("./config.json");
const challonge = require("challonge");
const CommandManager = require("./commandmanager");
const Manager = new CommandManager(client);
const Database = require("./database.js");
let currentTournament;
const fs = require("fs");

const tournament = challonge.createClient({
	apiKey: config.challonge
});

let tourneys = tournament.tournaments.index({
	callback: (err, data) => {
		if (err) {
			return console.log(err);
		}
		return checkTourney(data);
	}
});

function checkTourney(tourney) {
	if (
		!currentTournament ||
		currentTournament.state === "complete" ||
		currentTournament.state === "underway"
	) {
		return (currentTournament = {});
	}
	currentTournament = tourney[0];
	console.log(tourney[0]);
}

function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}

var user;
var id;
var discrim;
var email;
var avatar;
var amount;

paypal.configure({
	mode: "sandbox", //sandbox or live
	client_id: config.paypalID,
	client_secret: config.paypalSecret
});

const app = express();

app.set("view engine", "jade");

app.use(express.static(path.join(__dirname, "views")));
app.use(bodyParser.json());
app.use(
	bodyParser.urlencoded({
		extended: true
	})
);
app.get("/", (req, res) => res.render("index"));

app.post("/pay", (req, res) => {
	if (!req.body) {
		res.redirect("/");
	}
	user = req.body.name;
	id = req.body.id;
	email = req.body.email;
	discrim = req.body.discrim;
	amount = req.body.quantity;
	if (amount === 0) {
		amount = 1;
	}
	const create_payment_json = {
		application_context: {
			shipping_preference: "NO_SHIPPING"
		},
		intent: "sale",
		payer: {
			payment_method: "paypal"
		},
		redirect_urls: {
			return_url: `${config.site}/success`,
			cancel_url: `${config.site}/cancel`
		},
		transactions: [
			{
				payment_options: {
					allowed_payment_method: "INSTANT_FUNDING_SOURCE"
				},
				item_list: {
					items: [
						{
							name: "Anytime Ticket",
							price: "6.00",
							currency: "USD",
							quantity: amount
						}
					]
				},
				amount: {
					currency: "USD",
					total: amount * "6.00"
				},
				description: `${amount}x Duel Links Meta Anytime Tickets For ${user}#${discrim} | Discord Id: ${id}`
			}
		]
	};

	paypal.payment.create(create_payment_json, function(error, payment) {
		if (error) {
			console.log(JSON.stringify(error));
			throw error;
		} else {
			for (let i = 0; i < payment.links.length; i++) {
				if (payment.links[i].rel === "approval_url") {
					res.redirect(payment.links[i].href);
				}
			}
		}
	});
});

app.get("/success", (req, res) => {
	const payerId = req.query.PayerID;
	const paymentId = req.query.paymentId;

	const execute_payment_json = {
		payer_id: payerId,
		transactions: [
			{
				amount: {
					currency: "USD",
					total: amount * "6.00"
				}
			}
		]
	};
	paypal.payment.execute(paymentId, execute_payment_json, function(
		error,
		payment
	) {
		if (error) {
			console.log(error.response);
			throw error;
		} else {
			res.render("paid");
			sendPayment(payment);
		}
	});
});

var scopes = ["identify", "email"];

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

passport.use(
	new DiscordStrategy(
		{
			clientID: config.discordID,
			clientSecret: config.discordSecret,
			callbackURL: `${config.site}/api/discord/callback/`,
			scope: scopes
		},
		function(accessToken, refreshToken, profile, done) {
			process.nextTick(function() {
				return done(null, profile);
			});
		}
	)
);

app.use(
	session({
		secret: "tour guide",
		resave: false,
		saveUninitialized: false
	})
);

app.use(passport.initialize());
app.use(passport.session());

app.get(
	"/api/discord/callback/",
	passport.authenticate("discord", {
		failureRedirect: "/error"
	}),
	function(req, res) {
		res.redirect("/member");
	}
);

app.get("/member", checkAuth, async function(req, res) {
	let [person] = await Database.Models.Users.findOrCreate({
		where: {
			userid: req.user.id,
			username: req.user.username
		}
	}).all();
	res.render("member", {
		user: req.user.username,
		id: req.user.id,
		discrim: req.user.discriminator,
		avatar: req.user.avatar,
		tickets: person.tickets
	});
});

app.get("/login", passport.authenticate("discord", { scope: scopes }), function(
	req,
	res
) {});

app.get("/cancel", (req, res) => res.redirect("/member"));

app.listen(7911, () => console.log("Server Works"));

client.on("ready", () => {
	var guilds = client.guilds.map(x => x.id);
	console.log(`Logged in as ${client.user.tag}! on ${guilds}`);
});

client.on("message", async message => Manager.handleMessage(message));

client.on("message", async msg => {
	if (msg.author.bot) return;
	let user = msg.author;
	let [person] = await Database.Models.Users.findOrCreate({
		where: { userid: user.id, username: user.username }
	}).all();
	if (!person.tickets) {
		person.update({
			tickets: 0
		});
	}
	if (msg.content === "ping") {
		msg.reply("Pong!");
	}
	if (msg.content === "!tickets") {
		msg.reply(
			`You have ${person.tickets === null ? "0" : person.tickets} ${
				person.tickets === 1 ? "Ticket" : "Tickets"
			}`
		);
	}
	if (msg.content === "!redeem") {
		if (person.tickets === 0 || !person.tickets) {
			return msg.reply(
				`Sorry, you don't have any tickets :( please buy some at [url to site]`
			);
		}
		person.update({
			tickets: person.tickets - 1
		});
		msg.reply(
			`You have successfully redeemed 1 ticket! You have ${person.tickets} left!`
		);
		/* 		if (
			!currentTournament ||
			currentTournament.state === "complete" ||
			currentTournament.state === "underway"
		) */ {
			tournament.tournaments.create({
				tournament: {
					name: `anytime_tournament_${getRandomInt(100000)}`,
					url: `anytime_tournament_${getRandomInt(100000)}`,
					tournamentType: "single elimination"
				},
				callback: (err, data) => {
					console.log(data, err);
					checkTourney(data);
					msg.reply(
						`Tournament created at: ${data.tournament.fullChallongeUrl}`
					);
				}
			});
		}
		/* 		return await tournament.participants.create({
			id: currentTournament.tournament.url,
			participant: {
				name: person.username
			},
			callback: (err, data) => {
				msg.reply(
					`Good Luck & Have Fun :D ${person.username}! Tournament located at : ${currentTournament.tournament.fullChallongeUrl}`
				);
			}
		}); */
	}
});

client.login(config.discordToken);

async function sendPayment(payment) {
	let pay = payment;
	let info = pay.payer.payer_info;
	let amount = pay.transactions[0].amount;
	let quantity = pay.transactions[0].item_list.items[0].quantity;
	let transaction = pay.transactions[0].related_resources[0].sale.id;
	const channel = client.channels.find("name", "purchases");
	const author = client.users.get(id);
	let [person] = await Database.Models.Users.findOrCreate({
		where: { userid: id }
	}).all();
	if (!person.tickets) {
		person.update({
			tickets: quantity
		});
	} else {
		person.update({
			tickets: person.tickets + quantity
		});
	}
	if (!person.username) {
		person.update({
			username: user
		});
	}
	channel.send(
		`**SUCCESS**: :money_with_wings: Payment recieved from <@!${id}> | ${user}#${discrim} | Transaction ID: \`${transaction}\` | for ${
			amount.total
		} ${amount.currency} for ${quantity} ${
			quantity > 1 ? "tickets" : "ticket"
		}, this user has **${person.tickets}** now.`
	);
	author.send(
		`Thank you so much for your purchase of ${quantity} ${
			quantity > 1 ? "tickets" : "ticket"
		} you now have **${person.tickets}** :) `
	);
}

function test() {
	const channel = client.channels.find("name", "privatestuff");
}

function checkAuth(req, res, next) {
	if (req.isAuthenticated()) return next();
	res.redirect("/");
}
