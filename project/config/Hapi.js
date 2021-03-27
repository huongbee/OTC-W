module.exports = {
  isActive: true,
  server: {
    port: 3001,
    host: '0.0.0.0',
    routes: {
      validate: {
        failAction: (request, h, err) => {
          throw err;
        }
      }
    }
  },
  plugins: {
    cors: {
      isActive: true,
      options: {
        headers: []
      }
    },
    jwt: {
      isActive: true,
      options: {
        inject: ['Default', 'Partner', 'Admin'],
        default: {
          strategy: 'Default',
          payload: true
        }
      }
    },
    swagger: {
      isActive: true,
      options: {
        info: {
          title: 'OTC API',
          version: '1.0.1'
        },
        grouping: 'tags',
        expanded: 'list',
        tagsGroupingFilter: (tag) => {
          const _ = require('lodash');
          const VERSION = require('project/constants/Version');
          if (!_.includes(_.values(VERSION), tag) && !_.includes(['external', 'internal', 'api'], tag)) {
            return true;
          }
        },
        tags: [],
        securityDefinitions: {
          jwt: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header'
          }
        },
        security: [
          {
            jwt: [],
            checksum: []
          }
        ]
      }
    },
    apiReply: {
      isActive: true,
      options: {
        handleException: (error, request, reply) => {
          const project = require('..').getInstance();
          const logger = project.log4js.getLogger('system');
          logger.error(error);
          return true;
        },
        message: {
          401: 'Vui lòng đăng nhập',
          404: 'Api không tồn tại',
          500: 'Vui lòng thử lại!'
        }
      }
    },
    apiSecurity: {
      isActive: false,
      options: {
        client: {
          app: {
            publicKey: '',
            privateKey: ''
          }
        }
      }
    },
    apiVersion: {
      isActive: true,
      options: {
        validVersions: [1],
        defaultVersion: 1,
        vendorName: 'me'
      }
    },
    apiResponseTime: {
      isActive: true,
      options: {}
    },
    clientIp: {
      isActive: true,
      options: {}
    },
    i18n: {
      isActive: true,
      options: {}
    }
  }
};
