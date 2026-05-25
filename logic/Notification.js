// This class represents notification in the system.
class Notification {
    constructor(senderEmail, subject, body, recipientCount, date) {
        this.senderEmail = senderEmail;
        this.subject = subject;
        this.body = body;
        this.recipientCount = recipientCount;
        this.date = date;
    }
}

module.exports = Notification;