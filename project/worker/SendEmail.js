const _ = require('lodash');
const Async = require('async');
const EmailService = require('project/services/EmailService');

const Variable = {
  POOL_LOAD: null,
  POOL_EXECUTE: null,
  EMAILS: []
};

const Private = {
  async Delay(delayTime) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve();
      }, delayTime);
    });
  }
};

const Module = {
  pushSendEmail(email, message, subject, templateFileName) {
    Variable.EMAILS.push({ email, message, subject, templateFileName });
    return true;
  },

  async Init() {
    Variable.POOL_LOAD = Async.queue((task, callback) => {
      try {
        (async () => {
          if (Variable.EMAILS.length > 0) {
            const notifyInfo = Variable.EMAILS.shift();
            Variable.POOL_EXECUTE.push(notifyInfo);
          }
        })();
      } catch (error) {
        return error;
      } finally {
        callback();
      }
      return true;
    }, 1);

    Variable.POOL_EXECUTE = Async.cargo((tasks, callback) => {
      try {
        if (tasks[0] !== null) {
          const task = tasks[0];
          (async () => {
            const info = {
              content: {
                message: task.message,
                footer: 'OTC W'
              },
              email: {
                to: _.trim(task.email),
                subject: task.subject
              }
            };
            const templatePath = `${__dirname}/../views/emails/${task.templateFileName}.html`;
            const sent = EmailService.sendMail(templatePath, info)
              .then((r) => console.log('Send email passs', r))
              .catch((e) => console.log('Send email faillll', e))
              .finally(() => console.log('Send Email done!'));
            console.log({ sent });
            callback();
            return true;
          })();
        } else {
          callback();
          return false;
        }
      } catch (error) {
        throw error;
      }
    }, 1);

    Variable.POOL_LOAD.push(1);

    Variable.POOL_LOAD.drain((err) => {
      (async () => {
        Variable.POOL_EXECUTE.push(null);
      })();
    });

    Variable.POOL_EXECUTE.drain((err) => {
      (async () => {
        await Private.Delay(5000);
        Variable.POOL_LOAD.push(1);
      })();
    });
  }
};

module.exports = Module;
