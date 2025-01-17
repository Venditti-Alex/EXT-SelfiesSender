/**************************
*  EXT-SelfiesSender v1.0 *
*  Bugsounet              *
*  11/2022                *
***************************/

Module.register("EXT-SelfiesSender", {
  defaults: {
    debug: false,
    sendTelegramBotAuto: true,
    sendGooglePhotos: false,
    sendGooglePhotosAuto: false,
    sendMail: false,
    sendMailAuto: false,
    sendToPrinter: false,
    sendToPrinterAuto: false, // ou pas ?
    sendMailConfig: {
      transport: {
        host: 'smtp.mail.com',
        port: 465,
        secure: true,
        auth: {
          user: "youremail@mail.com",
          pass: "your mail password"
        }
      },
      message: {
        from: "EXT-SelfieSender <youremail@mail.com>",
        to: "who@where.com",
        subject: "EXT-SelfieSender -- This is your new selfie.",
        text: "New selfie."
      }
    },
    printerOptions: {}  // needed ?
  },

  start: function() {
    this.IsShooting = false
    this.lastPhoto = null
    this.session = {}
  },

  getDom: function() {
    var wrapper = document.createElement("div")
    wrapper.style.display = 'none'
    return wrapper
  },

  notificationReceived: function(noti, payload, sender) {
    switch(noti) {
      case "DOM_OBJECTS_CREATED":
        this.sendSocketNotification("INIT", this.config)
        break
      case "GAv4_READY":
        if (sender.name == "MMM-GoogleAssistant") this.sendNotification("EXT_HELLO", this.name)
        break
      case "EXT_SELFIES-RESULT":
        if (!payload) return // prevent crash
        this.lastPhoto = payload
        this.sendSelfie(payload)
        break
      case "EXT_SELFIES-CLEAN_STORE": // all is clean so reset all
        this.lastPhoto = null
        this.session = {}
        break
    }
  },

  socketNotificationReceived: function(noti, payload) {
    switch(noti) {
      case "ERROR": // will display error with EXT-Alert
        this.sendNotification("EXT_ALERT", {
          type: "error",
          message: payload
        })
    }
  },

 /** TelegramBot function **/
   getCommands: function(commander) {
    commander.add({
      command: 'selfie',
      callback: 'cmdSelfie',
      description: "Take a selfie.",
    })

    commander.add({
      command: 'emptyselfie',
      callback: 'cmdEmptySelfie',
      description: "Remove all selfie photos."
    })

    commander.add({
      command: 'lastselfie',
      callback: 'cmdLastSelfie',
      description: 'Display the last selfie shot taken.'
    })
  },

  cmdSelfie: function(command, handler) {
    if (this.IsShooting) return handler.reply("TEXT", "Not available actually.")
    let key = Date.now()
    this.session[key] = handler
    this.sendNotification("EXT_SELFIES-SHOOT", {TBkey:key})
  },

  cmdLastSelfie: function(command, handler) {
    if (this.IsShooting) return handler.reply("TEXT", "Not available actually.")
    if (this.lastPhoto) {
      if (handler.args) {
        var args = handler.args.toLowerCase().split(" ")
        switch (args[0]) {
          case "mail":
            if (this.config.sendMail) this.sendSocketNotification("MAIL", this.lastPhoto.path)
            handler.reply("TEXT", this.config.sendMail ? "Selfie sended by mail.": "Command disabled.")
            break
          case "screen":
            this.sendNotification("EXT_SELFIES-LAST")
            handler.reply("TEXT", "This is last selfie!")
            break
          case "gphotos":
            if (this.config.sendGooglePhotos) this.sendNotification("EXT_GPHOTOPHOTOS-UPLOAD", this.lastPhoto.path)
            handler.reply("TEXT", this.config.sendGooglePhotos ? "Selfie sended to EXT-GooglePhotos for upload.": "Command disabled.")
            break
          default:
            handler.reply("TEXT", 'Need Help for /lastselfie commands ?\n\n\
  *mail*: will send last photo by mail\n\
  *screen*: will display last photo in the screen of MagicMirror²\n\
  *gphotos*: will upload last selfie in google photo directory (need EXT-GooglePhotos)\n\
  With no argument: will send last photo in private message\
  ',{parse_mode:'Markdown'})
            break
        }
      } else {
        handler.reply("PHOTO_PATH", this.lastPhoto.path)
      }
    } else {
      handler.reply("TEXT", "Couldn't find the last selfie.")
    }
  },

  cmdEmptySelfie: function(command, handler) {
    if (this.IsShooting) return handler.reply("TEXT", "Not available actually.")
    this.sendNotification("EXT_SELFIES-EMPTY_STORE")
    this.lastPhoto = null
    this.session = {}
    handler.reply("TEXT", "done.")
  },

  sendSelfie: function(result) {
    // send to the user with TBkey
    let sendTBAdmin = true
    if (result.options.TBkey && this.session[result.options.TBkey]) {
      sendTBAdmin= false
      var handler = this.session[result.options.TBkey]
      handler.reply("PHOTO_PATH", result.path)
      this.session[result.options.TBkey] = null
      delete this.session[result.options.TBkey]
    }

    if (result.options.useTBKeyOnly) return // cas d'utilisation de sauvegarde locale uniquement (ignore le reste)

    if (this.config.sendGooglePhotos && this.config.sendGooglePhotosAuto) this.sendNotification("EXT_GPHOTOPHOTOS-UPLOAD", result.path)    
    // send to admins
    if (this.config.sendTelegramBotAuto && sendTBAdmin) {
      this.sendNotification("TELBOT_TELL_ADMIN", "New Selfie")
      this.sendNotification("TELBOT_TELL_ADMIN", {
        type: "PHOTO_PATH",
        path: result.path
      })
    }

    if (this.config.sendMail && this.config.sendMailAuto) this.sendSocketNotification("MAIL", result.path)
  
    if (this.config.sendToPrinter && this.config.sendToPrinterAuto) this.sendSocketNotification("PRINT", result.path)
  }
});
