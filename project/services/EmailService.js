const fs = require('fs');
const _ = require('underscore');
const nodemailer = require('nodemailer');

const EmailService = {
  options: {},
  data: {},

  getHtml(templatePath, data) {
    // const templatePath = `./projects/insight/views/emails/${templateName}.html`;
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = _.template(templateContent);
    const html = template({ content: data });
    return html;
  },

  sendMail(template, data) {
    try {
      return new Promise((resolve, reject) => {
        const html = EmailService.getHtml(template, data.content);
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false, // use SSL
          requireTLS: true,
          pool: true,
          auth: {
            user: 'otc.wmv.money@gmail.com',
            pass: 'qazxsw!321'
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        const mailOptions = {
          from: `${data.content.footer} <otc.wmv.money@gmail.com>`, // sender address
          to: data.email.to, // list of receivers
          bcc: data.email.bcc || '', // list of receivers
          subject: data.email.subject, // Subject line
          html,
          generateTextFromHTML: true,
          attachments: data.attachments || []
        };
        if (data.email.cc) {
          mailOptions.cc = data.email.cc;
        }

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log(error);
            reject(error);
          } else {
            resolve(info.response);
          }
        });
      });
    } catch (err) {
      console.log(err);
      return err;
    }
  }
};

module.exports = EmailService;
