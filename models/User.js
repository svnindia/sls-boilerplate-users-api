const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const pointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    required: true
  },
  coordinates: {
    type: [Number],
    required: true
  }
});

let UserSchema = new Schema({
  username: {type: String, required: true, max: 100},
  firstName: {type: String, required: true, max: 100},
  lastName: {type: String, required: true, max: 100},
  email: {type: String, required: true, max: 100},
  password: {type: String },
  country: {type: String, max: 100},
  dob: {type: String,  max: 100},
  active: { type: Boolean, default: false },
  mobile: {type: String, max: 12},
  otp: {type: String, max: 12},
  lastSeen: {
    updatedAt: { type: Date, default: Date.now },
    location: {
      type: pointSchema
    }
  },
});


// Export the model
module.exports = mongoose.model('User', UserSchema);
