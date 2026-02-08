#!/usr/bin/env python3

from urllib.parse import quote
filename = "「私と一緒に住むってどうかな？」1見た目ギャルな不器用美少女が俺と二人で暮らしたがる (HJ文庫).epub"
url = f"http://localhost:8080/resources/{quote(filename)}"
print(url)