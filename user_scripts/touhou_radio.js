// ==UserScript==
// @name         Touhou Radio Imitator
// @namespace    https://github.com/0x384c0/scripts/blob/master/user_scripts/touhou_radio.js
// @version      0.2
// @description  Plays random song from http://151.80.40.155/
// @author       0x384c0
// @match        http://151.80.40.155/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=40.155
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    class RandomPlayer{
        host = "/tlmc/";
        soundsFile = "/otokei.json";
        soundsDatabaseKey = 'soundsList';

        //Utils
        getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min) + min);
        }

        isJsonString(str) {
            try {
                JSON.parse(str);
            } catch (e) {
                return false;
            }
            return true;
        }

        // Player
        musicPlayer;
        currentSong = -1;

        setSong(index) {
            this.currentSong = index;
            this.musicPlayer.src = this.host + encodeURIComponent(this.currentPlaylist[index]);
            this.updateMusicPlayerSong(index)
        }

        initPlayer() {
            let randomPlayer = this;
            this.musicPlayer = document.createElement("audio");
            this.musicPlayer.controls = true;
            this.musicPlayer.volume = 0.4;
            this.musicPlayer.preload = true;
            this.musicPlayer.onended = function() {
                randomPlayer.setSong(randomPlayer.getNextSongId());
                randomPlayer.musicPlayer.play();
            };
            document.body.innerHTML = '';
            document.body.append(`${this.currentPlaylist.length} songs`);
            document.body.appendChild(document.createElement("br"));
            document.body.appendChild(this.musicPlayer);
            this.setSong(this.getNextSongId());
        }

        //Data
        soundsDatabase = [];
        currentPlaylist = [];
        initListing() {
            this.currentPlaylist = [];
            this.traverse(this.soundsDatabase,[],this.currentPlaylist);
        }

        findAudioFiles(keys, value, playlist){
            let lastKey = keys.slice(-1)[0];
            let pathKeys = keys.slice(0, -1);
            let divider = "/"
            let path = pathKeys.join(divider);
            if (lastKey == "files" && Array.isArray(value.files)){
                playlist.push(...(value.files.map(file => `${path}${divider}${file}`)));
                return true;
            } else {
                return false;
            }
        }

        traverse(obj,keys,playlist){
            for (var key in obj) {
                let nextObject = obj[key];
                let isObject = nextObject !== null && typeof(nextObject) == "object";
                keys.push(key);
                let isNotAudioFiles = !this.findAudioFiles(keys,obj,playlist);

                if (isObject && isNotAudioFiles){
                    this.traverse(nextObject,keys,playlist);
                }
                keys.pop();
            }
        }

        getNextSongId(){
            return this.getRandomInt(0,this.currentPlaylist.length - 1)
        }

        getListFromCache(){
            return new Promise((resolve, reject) => {
                let data = localStorage.getItem(this.soundsDatabaseKey);
                if (data != null && this.isJsonString(data)){
                    resolve(data);
                } else {
                    localStorage.removeItem(this.soundsDatabaseKey);
                    resolve(null);
                }
            });
        }

        async getListFromWeb(){
            const response = await fetch(this.soundsFile);
            console.log(this.soundsFile);
            console.log(response);
            const data = await response.text();
            localStorage.removeItem(this.soundsDatabaseKey);
            localStorage.setItem(this.soundsDatabaseKey, data);
            return data;
        }

        async downloadList(){
            var data = await this.getListFromCache();
            if (data == null){
                data = await this.getListFromWeb();
            }
            this.soundsDatabase = JSON.parse(data);
        }

        // UI
        updateMusicPlayerSong(index) {
            var current = this.currentPlaylist[index];
            document.body.appendChild(document.createElement("br"));
            document.body.append(current);
        }

        async init(){
            await this.downloadList();
            this.initListing();
            this.initPlayer();
        }
    }

    var player = new RandomPlayer();

    player.init();
})();