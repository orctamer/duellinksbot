const Database = require('./database')
const { RichEmbed, Client } = require('discord.js')
module.exports = class CommandManager {
    constructor(client) {
        this.client = client
        if (!this.client || !(this.client instanceof Client)) {
            throw new Error('Discord Client is required')
        }
    }
    async handleMessage(message) {
        if (message.author.bot) return false
        const channel = message.guild ? message.guild.name : 'DM'
        const user = message.author
        let person = await this.makeUser(user)
        if (message.content === '!profile') {
            return this.runTicket(user, message, person)
        }
        if (message.content === '!buy') {
            return this.buyTicket(user, message, person)
        }
    }
    async makeUser(user) {
        const db = Database.Models.Users
        let [person] = await db.findOrCreate({
            where: { userid: user.id, username: user.username }
        }).all()
        return person
    }
    async runTicket(user, message, person) {
        let channel = message.channel
        let embed = new RichEmbed()
        embed.setColor(0x7766FF)
        embed.setThumbnail(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=256`)
        embed.setTitle(`Anytime Tournament Information`)
        embed.setDescription(`Total Tickets: **${person.tickets || 0}**\nTotal Wins: ${person.wins || 0}\nTotal Losses: ${person.losses || 0}`)
        embed.setAuthor(`${user.username}`, 'https://i.imgur.com/qSO53Z6.png')
        channel.send(embed)
        message.delete()
    }
    async buyTicket(user, message, person) {
        let channel = message.channel
        if (!person.tickets) {
            person.update({
                tickets: 0
            })
        }
        person.update({
            tickets: person.tickets + 1
        })
        message.reply(`${user.username}: You have **${person.tickets || 0}** ${person.tickets > 1 ? 'tickets' : 'ticket' }`)
        message.delete()
    }
}