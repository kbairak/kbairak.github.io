install:
	bundle install

serve: install
	bundle exec jekyll serve

reloadserve: install
	bundle exec jekyll serve --livereload

draftreloadserve: install
	bundle exec jekyll serve --livereload --drafts

build:
	bundle exec jekyll build

watchbuild:
	bundle exec jekyll build --watch
