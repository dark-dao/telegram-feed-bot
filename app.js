'use strict';

var _ = require('lodash');
var fs = require("fs");

var config = require('./config');

var token = config.token;
var main_url = config.main_url;
var shop_url = config.shop_url;
var chatIds = config.users_id;

var TelegramBot = require('node-telegram-bot-api');
var botOptions = {
  polling: true
};
var bot = new TelegramBot(token, botOptions);

var request = require("request");
var cheerio = require("cheerio");
var CronJob = require('cron').CronJob;

var mainPageText = "";
var shopPageText = "";
var ERROR_MESSAGE = "";


var telegramSendMessage = function(message_text) {
  _.map(chatIds, id => {
    bot.sendMessage(id, message_text, {caption: "I'm a bot!"});
  });
};

try {
  var job = new CronJob({
    cronTime: '0 */2 * * * *',
    onTick: function() {
      console.log('<- TICK ->');

      /*--- Request to MAIN page ---*/
      request(main_url, function (error, response, body) {
        var date = new Date();
        if (!error) {
          console.log('<- LOAD_MAIN_PAGE ->');

          var $ = cheerio.load(body);
          var elemHref = $("dl#ic_recentposts > dt > strong > a");
          var elemTime = $("dl#ic_recentposts > dd");
          var items = "";

          _.map(elemHref, (val, i) => {
            var head = $(val).text();
            var href = $(val).attr('href');
            var time = $(elemTime[i]).text();
            items += "\n" + time + "\n" + head + "\n" + href + "\n";
          });

          if(mainPageText !== items) {
            console.log('<- SEND_MESSAGE ->');
            ERROR_MESSAGE = "";
            mainPageText = items;
            telegramSendMessage(mainPageText);
          }
        } else {
          console.log("Произошла ошибка: " + error);
          ERROR_MESSAGE = "Ошибка загрузки страницы: " + main_url +  "\n" + error + "\n" + date.toTimeString() + "\n";
          fs.appendFile("errors-log.txt", ERROR_MESSAGE,  "utf-8");
          telegramSendMessage(error);
        }
      });

      /*--- Request to SHOP page ---*/
      request(shop_url, function (error, response, body) {
        var date = new Date();
        if(!error) {
          console.log('<- LOAD_SHOP_PAGE ->');

          var $ = cheerio.load(body);
          var elemText = $("div#messageindex > table > tbody > tr > td > div > span > a");
          var items = "";

          _.map(elemText, val => {
            var text = $(val).text();
            var href = $(val).attr("href");
            items += text + '\n' + href + '\n';
          });

          if(shopPageText !== items) {
            console.log('<- SEND_MESSAGE ->');
            ERROR_MESSAGE = "";
            shopPageText = items;
            telegramSendMessage(shopPageText);
          }
        } else {
          console.log("Произошла ошибка: " + error);
          ERROR_MESSAGE = "Ошибка загрузки страницы: " + shop_url +  "\n" + error + "\n" + date.toTimeString() + "\n";
          fs.appendFile("errors-log.txt", ERROR_MESSAGE,  "utf-8");
          telegramSendMessage(error);
        }
      });
    },
    start: false,
    timeZone: 'America/Los_Angeles'
  });
} catch(ex) {
  ERROR_MESSAGE = "Невалидный паттерн для расписаний (cron)" + "\n";
	fs.appendFile("errors-log.txt", ERROR_MESSAGE,  "utf-8");
}

console.log('job status:' + job.running);
job.start();
console.log('job status:' + job.running);

bot.getMe().then(function(me)
{
    console.log('Hello! My name is %s!', me.first_name);
    console.log('My id is %s.', me.id);
    console.log('And my username is @%s.', me.username);
});

bot.on('message', function (msg) {
  var messageText = msg.text;
  var chatId = msg.chat.id;

  if(messageText === "/help_admin") {
    var adminCommands = "/get_errors список ошибок \n /get_cron_status статус расписания \n /stop_cron_process остановка расписания \n /start_cron_process старт расписания \n";
    bot.sendMessage(chatId, "Список админ-команд: \n" + adminCommands, {caption: "I'm a bot!"});
  }

  if(messageText === "/get_errors") {
    fs.readFile('errors-log.txt', 'utf8', function(err, contents) {
      console.log(contents);
      bot.sendMessage(chatId, "Список ошибок: \n" + contents, {caption: "I'm a bot!"});
    });
  }

  if(messageText === "/get_cron_status") {
    var cronStatus = "Остановлено!";
    if(job.running) {
      cronStatus = "Выполняется!"
    }
    bot.sendMessage(chatId, "Статус расписания (cron): \n" + cronStatus, {caption: "I'm a bot!"});
  }

  if(messageText == "/stop_cron_process") {
    bot.sendMessage(chatId, "Остановка расписания (cron) . . . \n", {caption: "I'm a bot!"});
    mainPageText = "";
    shopPageText = "";
    ERROR_MESSAGE = "";
    job.stop();
  }

  if(messageText == "/start_cron_process") {
    bot.sendMessage(chatId, "Запуск расписания (cron) . . . \n", {caption: "I'm a bot!"});
    if(!job.running) {
      job.start();
    } else {
      bot.sendMessage(chatId, "РАсписание уже было запущено!\n", {caption: "I'm a bot!"});
    }
  }
});
