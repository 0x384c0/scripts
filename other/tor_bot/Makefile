all:
	$(MAKE) runLoop

setup:
	echo "python 3.7 is required"
	python -m venv venv
	source venv/Scripts/activate
	python -m pip install pypiwin32
	python -m pip install carml

runLoop:
	number=1 ; while [[ $$number -le 20 ]] ; do \
        echo "task: $$number" ;\
        ((number = number + 1)) ;\
        $(MAKE) run ;\
    done


run:
	carml --connect 9151 circ --list
	carml --connect 9151 circ --list | grep -owE '[0-9]+' | xargs -n1 -I{} -P5 carml --connect 9151 circ --delete {}
	carml --connect 9151 circ --build auto
	echo "Requesting:\n"
	curl --socks5-hostname localhost:9150 "icanhazip.com"