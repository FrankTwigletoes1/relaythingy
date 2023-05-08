'use strict';

const fs = require('fs');
const io = require('socket.io-client');
const request = require('request');

const config = fs.readFileSync(__dirname + '/config.json');
const ESP8266_IP = JSON.parse(config).ip;
const ESP8266_PORT = JSON.parse(config).port;


const ON_INTERVAL = 5000; // check for music playing every 5 seconds
const OFF_INTERVAL = 60000; // turn off relay 1 minute after music stops
const STATE_INTERVAL = 120000; // check state every 2 minutes

let onTimer = null;
let offTimer = null;
let stateTimer = null;

let isPlaying = false;
let isOn = false;

const toggleRelay = () => {
  request.get(`http://${ESP8266_IP}:${ESP8266_PORT}/toggle`, (err, res, body) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Toggled relay');
      isOn = !isOn;
    }
  });
};

const checkState = () => {
  request.get(`http://${ESP8266_IP}:${ESP8266_PORT}/state`, (err, res, body) => {
    if (err) {
      console.error(err);
    } else {
      const state = body.trim();
      if ((isPlaying && state === 'OFF') || (!isPlaying && state === 'ON')) {
        console.log(`Incorrect state: ${state}, toggling relay`);
        toggleRelay();
      }
    }
  });
};

const startOnTimer = () => {
  if (!onTimer) {
    onTimer = setInterval(() => {
      if (!isPlaying && isOn) {
        console.log('Music is not playing, turning off relay');
        toggleRelay();
      }
    }, ON_INTERVAL);
  }
};

const stopOnTimer = () => {
  clearInterval(onTimer);
  onTimer = null;
};

const startOffTimer = () => {
  if (!offTimer) {
    offTimer = setTimeout(() => {
      if (isOn) {
        console.log('Music has stopped, turning off relay');
        toggleRelay();
      }
    }, OFF_INTERVAL);
  }
};

const stopOffTimer = () => {
  clearTimeout(offTimer);
  offTimer = null;
};

const startStateTimer = () => {
  if (!stateTimer) {
    stateTimer = setInterval(checkState, STATE_INTERVAL);
  }
};

const stopStateTimer = () => {
  clearInterval(stateTimer);
  stateTimer = null;
};

module.exports = function (context) {
  let socket = io.connect(`http://${context.host}:${context.port}`);

  socket.on('play', () => {
    console.log('Music is playing');
    isPlaying = true;
    startOnTimer();
    stopOffTimer();
    startStateTimer();
  });

  socket.on('pause', () => {
    console.log('Music is paused');
    isPlaying = false;
    stopOnTimer();
    startOffTimer();
    startStateTimer();
  });

  socket.on('stop', () => {
    console.log('Music has stopped');
    isPlaying = false;
    stopOnTimer();
    startOffTimer();
    startStateTimer();
  });

  return {
    stop: function () {
      console.log('Stopping plugin');
      stopOnTimer();
      stopOffTimer();
      stopStateTimer();
      socket.disconnect();
    },
  };
};
