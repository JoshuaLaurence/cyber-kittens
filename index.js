require("dotenv").config();
const express = require("express");
const app = express();
const {User, Kitten} = require("./db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

JWT_SECRET = process.env.JWT_SECRET;
SALT_COUNT = 10;

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get("/", async (req, res, next) => {
	try {
		res.send(`
      <h1>Welcome to Cyber Kittens!</h1>
      <p>Cats are available at <a href="/kittens/1">/kittens/:id</a></p>
      <p>Create a new cat at <b><code>POST /kittens</code></b> and delete one at <b><code>DELETE /kittens/:id</code></b></p>
      <p>Log in via POST /login or register via POST /register</p>
    `);
	} catch (error) {
		console.error(error);
		next(error);
	}
});

// Verifies token with jwt.verify and sets req.user
// TODO - Create authentication middleware

app.use((req, res, next) => {
	const auth = req.header("Authorization");
	if (!auth) next();
	else {
		const [, token] = auth.split(" ");
		try {
			const user = jwt.verify(token, JWT_SECRET);
			if (!user) res.sendStatus(401);
			req.user = user;
			next();
		} catch (error) {
			res.sendStatus(401);
		}
	}
});

// POST /register
// OPTIONAL - takes req.body of {username, password} and creates a new user with the hashed password
app.post("/register", async (req, res, next) => {
	try {
		const {username, password} = req.body;
		const hashedPassword = await bcrypt.hash(password, SALT_COUNT);

		const {id} = await User.create({
			username: username,
			password: hashedPassword,
		});
		const token = jwt.sign({id, username}, JWT_SECRET);

		res.status(200).send({message: "success", token: token});
	} catch (error) {
		console.log(error);
		next(error);
	}
});

// POST /login
// OPTIONAL - takes req.body of {username, password}, finds user by username, and compares the password with the hashed version from the DB
app.post("/login", async (req, res, next) => {
	try {
		const {username, password} = req.body;
		const foundUser = await User.findAll({where: {username: username}});

		const correctPassword = await bcrypt.compare(password, foundUser[0].password);
		if (!correctPassword) res.status(401).send("Unauthorized");
		else {
			const token = jwt.sign(username, JWT_SECRET);
			res.status(200).send({message: "success", token: token});
		}
	} catch (error) {
		console.log(error);
		next(error);
	}
});

// GET /kittens/:id
// TODO - takes an id and returns the cat with that id
app.get("/kittens/:id", async (req, res, next) => {
	try {
		if (!req.user) res.status(401).send("Unauthorized");
		const [foundKitten] = await Kitten.findAll({
			where: {id: req.params.id},
			include: User,
			attributes: ["id", "name", "color", "age", "ownerId"],
		});
		if (foundKitten.ownerId !== req.user.id) res.sendStatus(401);
		else res.status(200).send(foundKitten);
	} catch (error) {
		console.log(error);
		next(error);
	}
});

// POST /kittens
// TODO - takes req.body of {name, age, color} and creates a new cat with the given name, age, and color
app.post("/kittens", async (req, res, next) => {
	try {
		if (!req.user) res.status(401).send("Unauthorized");
		const {name, age, color} = req.body;
		const newKitten = await Kitten.create({
			name,
			age,
			color,
			ownerId: req.user.id,
		});
		res
			.status(201)
			.send({
				name: newKitten.name,
				age: newKitten.age,
				color: newKitten.color,
				id: newKitten.id,
			});
	} catch (error) {
		console.log(error);
		next(error);
	}
});

// DELETE /kittens/:id
// TODO - takes an id and deletes the cat with that id
app.delete("/kittens/:id", async (req, res, next) => {
	try {
		if (!req.user) res.status(401).send("Unauthorized");
		const foundKitten = await Kitten.findByPk(req.params.id);
		if (foundKitten.ownerId !== req.user.id) res.sendStatus(401);
		else {
			const deletedKitten = await Kitten.destroy({where: {id: req.params.id}});
			res
				.status(204)
				.send(`Successfully deleted the Kitten with the ID of ${req.params.id}`);
		}
	} catch (error) {
		console.log(error);
		next(error);
	}
});

// error handling middleware, so failed tests receive them
app.use((error, req, res, next) => {
	console.error("SERVER ERROR: ", error);
	if (res.statusCode < 400) res.status(500);
	res.send({error: error.message, name: error.name, message: error.message});
});

// we export the app, not listening in here, so that we can run tests
module.exports = app;
