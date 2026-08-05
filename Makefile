NPM = npm
.PHONY: install lint test sonar all

install:
	$(NPM) ci

lint:
	$(NPM) run lint

test:
	$(NPM) test -- --coverage


validate: install lint test