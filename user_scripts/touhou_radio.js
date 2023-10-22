// ==UserScript==
// @name         Touhou Radio Imitator
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Plays random song from http://151.80.40.155/
// @author       You
// @match        http://151.80.40.155/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=40.155
// @grant        none
// ==/UserScript==

(function () {
    'use strict'

    class RandomPlayer {
        host = "/tlmc/"
        soundsFile = "/otokei.json"
        soundsDatabaseKey = 'soundsList'

        //Utils
        getRandomInt(min, max) {
            min = Math.ceil(min)
            max = Math.floor(max)
            return Math.floor(Math.random() * (max - min) + min)
        }

        isJsonString(str) {
            try {
                JSON.parse(str)
            } catch (e) {
                return false
            }
            return true
        }

        // Player
        musicPlayer
        currentSong = -1

        setSong(index) {
            this.currentSong = index
            this.musicPlayer.src = this.getSongUrl(this.currentPlaylist[index])
            this.updateMusicPlayerSong(index)
        }

        getSongUrl(song) {
            return this.host + encodeURIComponent(song)
        }

        initPlayer() {
            let randomPlayer = this
            this.musicPlayer = document.createElement("audio")
            this.musicPlayer.controls = true
            this.musicPlayer.volume = 0.4
            this.musicPlayer.preload = true
            this.musicPlayer.onended = function () {
                randomPlayer.setSong(randomPlayer.getNextSongId())
                randomPlayer.musicPlayer.play()
            }
            document.body.innerHTML = ''
            document.body.append(`${this.currentPlaylist.length} songs`)
            document.body.appendChild(document.createElement("br"))
            document.body.appendChild(this.musicPlayer)
            this.setSong(this.getNextSongId())
        }

        //Data
        soundsDatabase = []
        currentPlaylist = []
        initListing() {
            this.currentPlaylist = []
            this.traverse(this.soundsDatabase, [], this.currentPlaylist)
        }

        findAudioFiles(keys, value, playlist) {
            let lastKey = keys.slice(-1)[0]
            let pathKeys = keys.slice(0, -1)
            let divider = "/"
            let path = pathKeys.join(divider)
            if (lastKey == "files" && Array.isArray(value.files)) {
                playlist.push(...(value.files.map(file => `${path}${divider}${file}`)))
                return true
            } else {
                return false
            }
        }

        traverse(obj, keys, playlist) {
            for (var key in obj) {
                let nextObject = obj[key]
                let isObject = nextObject !== null && typeof (nextObject) == "object"
                keys.push(key)
                let isNotAudioFiles = !this.findAudioFiles(keys, obj, playlist)

                if (isObject && isNotAudioFiles) {
                    this.traverse(nextObject, keys, playlist)
                }
                keys.pop()
            }
        }

        getNextSongId() {
            return this.getRandomInt(0, this.currentPlaylist.length - 1)
        }

        getListFromCache() {
            return new Promise((resolve, reject) => {
                let data = localStorage.getItem(this.soundsDatabaseKey)
                if (data != null && this.isJsonString(data)) {
                    resolve(data)
                } else {
                    localStorage.removeItem(this.soundsDatabaseKey)
                    resolve(null)
                }
            })
        }

        async getListFromWeb() {
            const response = await fetch(this.soundsFile)
            console.log(this.soundsFile)
            console.log(response)
            const data = await response.text()
            localStorage.removeItem(this.soundsDatabaseKey)
            localStorage.setItem(this.soundsDatabaseKey, data)
            return data
        }

        async downloadList() {
            var data = await this.getListFromCache()
            if (data == null) {
                data = await this.getListFromWeb()
            }
            this.soundsDatabase = JSON.parse(data)
        }

        // UI
        updateMusicPlayerSong(index) {
            var current = this.currentPlaylist[index]
            document.body.appendChild(document.createElement("br"))
            document.body.append(current)
        }

        async init() {
            await this.downloadList()
            this.initListing()
            this.initPlayer()
        }
    }

    class PlaylistGenerator {
        // Playlist
        initSavePlaylistButton() {
            const button = document.createElement('button')
            button.textContent = 'Save as Playlist'
            button.addEventListener('click', () => {
                this.generateAndDownloadM3U8(this.getUrls(), "Touhou things.m3u8")
            })
            document.body.appendChild(document.createElement("br"))
            document.body.appendChild(button)
        }

        generateAndDownloadM3U8(urls, filename) {
            // Create the M3U8 content by joining the URLs with appropriate M3U8 format
            const m3u8Content = "#EXTM3U\n" + urls.map(url => `#EXTINF:-1,Video\n${url}`).join("\n")
            const blob = new Blob([m3u8Content], { type: "application/vnd.apple.mpegurl" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)
        }

        getUrls() {
            return this.player.currentPlaylist
                .map((name) => { return this.player.getSongUrl(name) })
                .map((path) => { return window.location.origin + path })
        }

        init(player) {
            this.player = player
            this.initSavePlaylistButton()
        }
    }

    var player = new RandomPlayer()
    var playlistGenerator = new PlaylistGenerator()

    player
        .init()
        .then(() => { playlistGenerator.init(player) })
})()