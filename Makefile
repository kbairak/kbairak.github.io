install:
	bundle install

serve:
	bundle exec jekyll serve

reloadserve:
	bundle exec jekyll serve --livereload

draftreloadserve:
	bundle exec jekyll serve --livereload --drafts

build:
	bundle exec jekyll build

watchbuild:
	bundle exec jekyll build --watch
