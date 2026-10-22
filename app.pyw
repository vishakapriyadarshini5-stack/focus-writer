import os
import webview

BASE = os.path.dirname(os.path.abspath(__file__))

webview.create_window("Focus Writer", os.path.join(BASE, "index.html"), width=1000, height=700)
webview.start(private_mode=False, storage_path=os.path.join(BASE, "webdata"))