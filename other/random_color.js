function setRandomColors() {
    var al = document.getElementsByTagName("*")
    var q
    for (q = 0; q < al.length; q++) {
        al[q].style.background = "rgb(" + Math.floor(Math.random() * 55 + 200) + "," + Math.floor(Math.random() * 55 + 200) + "," + Math.floor(Math.random() * 55 + 200) + ")"
        var cstyle = window.getComputedStyle(al[q], null)

        al[q].onclick = function(e) {
            this.style.background = "rgb(" + Math.floor(Math.random() * 55 + 200) + "," + Math.floor(Math.random() * 55 + 200) + "," + Math.floor(Math.random() * 55 + 200) + ")"
            if (Math.random() > .9) {
                this.className = ""
            }
            e.stopPropagation()
        }
    }
}

setRandomColors()
setInterval(setRandomColors, 500)