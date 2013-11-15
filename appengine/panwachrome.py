import webapp2
import logging
import os
from google.appengine.ext.webapp import template
from google.appengine.api import memcache
from google.appengine.api import urlfetch
from google.appengine.ext import db
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

class CrxVersion(db.Model):
	version = db.StringProperty(required=True)
	time = db.DateTimeProperty(auto_now=True)
	blobkey = db.StringProperty(required=True)

class Utils:
	@staticmethod
	def getlastversion():
		lversion = memcache.get("lversion")
		if lversion is not None:
			return lversion
		else:
			q = CrxVersion.all()
			q.order("-time")
			lversion = q.get()
			if lversion is None:
				lversion = ""
			else:
				lversion = lversion.version
			memcache.set("lversion", lversion)
			return lversion

class GetUpdates(webapp2.RequestHandler):
	def get(self):
		path = os.path.join(os.path.dirname(__file__), 'updates.xml')
		self.response.out.write(template.render(path, { "lversion": Utils.getlastversion() }))

class GetCRX(blobstore_handlers.BlobstoreDownloadHandler):
	def get(self):
		ver = self.request.get("v", default_value=Utils.getlastversion())
		resource = CrxVersion.all().filter("version =", ver).get()
		if resource is None:
			return
		else:
			resource = resource.blobkey
		blob_info = blobstore.BlobInfo.get(resource)
		self.response.headers['Content-Type'] = 'application/x-chrome-extension'
		self.send_blob(blob_info, save_as='panwachrome-'+ver+'.crx')

class UploadFormHandler(webapp2.RequestHandler):
	def get(self):
		upload_url = blobstore.create_upload_url('/upload')
		self.response.out.write('<html><body>')
		self.response.out.write('<p>Last version is: '+Utils.getlastversion())
		self.response.out.write('<form action="%s" method="POST" enctype="multipart/form-data">' % upload_url)
		self.response.out.write("""Upload File: <input type="file" name="file"><br> <input name="v" type="text" size="10"/><br> <input type="submit" name="submit" value="Submit"> </form></body></html>""")

class UploadHandler(blobstore_handlers.BlobstoreUploadHandler):
	def __savelastversion(self, version, key):
		crxver = CrxVersion(version=version, blobkey=key)
		crxver.put()
		memcache.delete("lversion")

	def post(self):
		upload_files = self.get_uploads('file')  # 'file' is file upload field in the form
		ver = self.request.get("v")
		blob_info = upload_files[0]
		if ver == "":
			blob_info.delete()
		self.__savelastversion(ver, str(blob_info.key()))
		self.response.headers['Content-Type'] = 'text/plain'
		self.response.out.write('Done, now the last version is '+Utils.getlastversion())
	
class MainPage(webapp2.RequestHandler):
	def get(self):
		self.response.headers['Content-Type'] = 'text/plain'
		self.response.out.write('Hello, this is Pan(w)achrome !')

app = webapp2.WSGIApplication([('/', MainPage),
								('/updates.xml', GetUpdates),
								('/upload', UploadHandler),
								('/uploadform.html', UploadFormHandler),
								('/crx', GetCRX)],
                              debug=False)