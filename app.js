'use strict';

// eslint-disable-next-line import/no-unresolved
const express = require('express');
const mongoose = require('mongoose');
const _ = require('lodash');
const parser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const request = require('request');
const jwt = require('jsonwebtoken');

const app = express();
const appJwtSecret = 'it5-hard-to-f1nd';

const dbConfig = {
  url: 'mongodb://localhost:27017/lambda',
  options: {
    authSource: 'admin',
    keepAlive: 300000,
    connectTimeoutMS: 300000
  },
}
mongoose.connect(dbConfig.url, dbConfig.options)

let db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function callback() {
  console.log("DB connected...")
})

app.use(parser.urlencoded({ extended: false }));
app.use(parser.json());
app.use(cors());

//Helper
const digit = () => { return _.random(parseInt('0'),parseInt('9')).toString() }

const genToken = (info) => { 
  const access = jwt.sign({
    "userName": info.username,
    "email": info.email,
    "iat": Math.floor(Date.now() / 1000) - 30,
    "exp": Math.floor(Date.now() / 1000) + (60 * 5)
  }, appJwtSecret);

  const refresh = jwt.sign({
    "userId": info._id,
    "iat": Math.floor(Date.now() / 1000) - 30,
    "exp": Math.floor(Date.now() / 1000) + ((60 * 60) * 420)
  }, appJwtSecret);
  return { access, refresh }
}


const jwtTest = async function(req, res, next) {
  jwt.verify(req.headers['authorization'], appJwtSecret, function(err, info) {
    if (err) {
      res.status(400).json(err);
    } else {
      req.email = info.email;
      next();
    }
  });
}

const jwtRefresh = async function(req, res, next) {
  jwt.verify(req.headers['authorization'], appJwtSecret, function(err, info) {
    if (err) {
      res.status(400).json(err);
    } else {
      req.userId = info.userId;
      next();
    }
  });
}

//Models
const User = require('./models/User.js');

// Routes
/* Signup */
app.post('/register', async function(req, res, next) {
  const reqUser = _.pick(req.body, ['username', 'firstName', 'lastName', 'email', 'password']);
  try {

    const userExists = await User.find({email: req.body.email}).count();
    if (!userExists) {
      let newUser = new User(_.defaults(reqUser, { username: '', firstName: '', lastName: '', email: '', password: '' }));
      newUser.otp = digit() + digit() + digit() + digit();
      
      const hash = await bcrypt.hash(reqUser.password, 10);
      newUser.password = hash
      newUser.lastSeen.location = {
        type: 'Point',
        coordinates: _.get(req.body, 'coordinates',[0,0])
      }
      newUser.save().then(function(data,err){
        if (err) {
          return next(err);
        }
        // const msg = 'Dear ' + newUser.mobile + ', Thanks for registering to our site. Your OTP is ' + newUser.otp +' If you are interested to participate please click this link https://bit.ly/give-a-ride to install our Android app.';
        // const smscUrl = 'http://smsc.biz/httpapi/send?username=123&password=456&sender_id=SMSIND&route=T&phonenumber=' + newUser.mobile + '&message=' + msg;
        // request(smscUrl);
        res.json({msg: "User Created"});
      });
    } else {
      res.status(409).json({ message: "Email Already Found" });
    }
  } catch (err) {
    console.log("Error ???")
    next(err);
  }
});


/* OTP */
app.post('/email/validate', function(req, res, next) {
  const reqUser = _.pick(req.body, ['email', 'otp']);
  try {
    let info = User.findOne({email: req.body.email, otp: req.body.otp}).then(async function(user){
      if (user && _.trim(user.email) !== '' && _.trim(user.otp) !== '') {
        //activate the user
        user.active = true;
        await user.save()
        res.json({'msg': 'activated'})
      } else{
        res.status(401).json({ message: "Not Valid User/Password" });
      }
    })
  } catch (err) {
    console.log("Error ???")
    next(err);
  }
});

/* Login */
app.post('/login', function(req, res, next) {
  let info = User.findOne({email: req.body.email}).then(async function(info) {
    let valid = false;
    if (_.trim(info.email) !== '' && _.trim(info.password) !== '') {
      valid = await bcrypt.compare(req.body.password, info.password);
    }
    if (valid) {
      res.json(genToken(info))
    } else {
      res.status(401).json({ message: "Not Valid User/Password" });
    }
  }).catch(function(err){
    console.log('error  ', err);
    res.status(400).json({ message: "Not Valid User/Password" });
  });
});
/* Me */
app.get('/me',jwtTest, function(req, res, next) {
  let info = User.findOne({email:req.email}, { password: 0, otp: 0}).then(function(info){
    res.json(info)
  });
});

/* Refresh Token */
app.get('/token/refresh',jwtRefresh, function(req, res, next) {
  let info = User.findOne({_id:req.userId}, { password: 0, otp: 0}).then(function(info){
    res.json(genToken(info))
  });
});

app.get('/*', (req, res) => {
  res.json({msg: "Hello World!"})
});

// Error handler
app.use((err, req, res) => {
  console.error(err);
  res.status(500).send('Internal Serverless Error');
});

module.exports = app;
