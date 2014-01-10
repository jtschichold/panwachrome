SRCDIR = panwachrome
BUILDDIR = build

ZIPFILE = panwachrome.zip

CSSMINIFIER = yuglify
CSSMINFLAGS = --type css

JSMINIFIER = yuglify
JSMINFLAGS = --type js

CSS_FILES := $(addprefix $(BUILDDIR)/css/, $(notdir $(wildcard $(SRCDIR)/css/*.css)))
IMAGES = images
FONTS = fonts
JS_FILES := $(addprefix $(BUILDDIR)/, $(filter-out .min.js,$(notdir $(wildcard $(SRCDIR)/*.js))))
OTHER_FILES := $(addprefix $(BUILDDIR)/, $(notdir $(wildcard $(SRCDIR)/*.html))) $(BUILDDIR)/manifest.json

.PHONY : clean $(BUILDDIR) $(IMAGES) $(FONTS)

all: $(ZIPFILE)

$(ZIPFILE): $(BUILDDIR) $(IMAGES) $(FONTS) $(CSS_FILES) $(JS_FILES) $(OTHER_FILES)
	zip -r $(ZIPFILE) $(BUILDDIR)/* 

$(BUILDDIR):
	mkdir -p $@
	mkdir -p $@/css
	mkdir -p $@/images
	mkdir -p $@/fonts

$(IMAGES): $(BUILDDIR)
	cp -f $(SRCDIR)/$(IMAGES)/* $(BUILDDIR)/$(IMAGES)/

$(FONTS): $(BUILDDIR)
	cp -f $(SRCDIR)/$(FONTS)/* $(BUILDDIR)/$(FONTS)/

$(BUILDDIR)/css/%.css: $(SRCDIR)/css/%.css
	cat $< | $(CSSMINIFIER) $(CSSMINFLAGS) --terminal --output $@

$(BUILDDIR)/%.js: $(SRCDIR)/%.js
	cat $< | $(JSMINIFIER) $(JSMINFLAGS) --terminal --output $@

$(BUILDDIR)/%: $(SRCDIR)/%
	cp -f $< $@

clean:
	rm -rf $(BUILDDIR)
	rm -rf $(ZIPFILE)

