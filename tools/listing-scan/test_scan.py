"""Checks for the price and area reading in scan.py.

    python3 -m unittest discover tools/listing-scan
"""
import unittest

from scan import find_areas, find_prices, parse_number, read_listing


class Numbers(unittest.TestCase):
    def test_conventions(self):
        for raw, want in [("724", 724), ("4,377", 4377), ("357.233", 357233), ("1.586.520", 1586520),
                          ("295,000.00", 295000), ("1.250,50", 1250.5), ("12,5", 12.5), ("2.320", 2320)]:
            self.assertEqual(parse_number(raw), want, raw)


class Prices(unittest.TestCase):
    def first(self, text):
        return next(find_prices(text))[:2]

    def test_currencies(self):
        self.assertEqual(self.first("Asking USD 200,693"), (200693, "USD"))
        self.assertEqual(self.first("Price: $ 264.600 USD"), (264600, "USD"))
        self.assertEqual(self.first("Afl. 357.233"), (357233, "AWG"))
        self.assertEqual(self.first("450,000 florins"), (450000, "AWG"))
        self.assertEqual(self.first("US$1.5M"), (1_500_000, "USD"))

    def test_rent_is_skipped(self):
        self.assertEqual(list(find_prices("$1,800 / month")), [])


class Areas(unittest.TestCase):
    def test_labels(self):
        found = [(round(a), k) for a, k, _ in find_areas("Lot size: 900 m² · Built area 180 m2")]
        self.assertEqual(found, [(900, "lotsize"), (180, "built")])
        found = [(round(a), k) for a, k, _ in find_areas("Lot Number 809: 700 m2")]
        self.assertEqual(found, [(700, "lot")])

    def test_units(self):
        (a, _, _), = find_areas("7793,07 ft²")
        self.assertAlmostEqual(a, 724, delta=1)
        (a, _, _), = find_areas("0.5 ha")
        self.assertEqual(a, 5000)


class Listing(unittest.TestCase):
    def test_text_listing(self):
        body = """<html><title>x</title><body><nav>Sold homes $9,999,999</nav>
        <h1>Full ownership land in Savaneta</h1>
        <p>USD 295,000</p><ul><li>Lot size: 844 m²</li></ul>
        <h2>Similar properties</h2><p>USD 10,000 · 5,000 m²</p></body></html>"""
        r = read_listing("https://example.aw/l/1", body, 2.05)
        self.assertEqual(r["price_awg"], round(295000 * 1.79))
        self.assertEqual(r["lot_m2"], 844)
        self.assertEqual(r["tenure"], "freehold")
        self.assertEqual(r["status"], "")

    def test_lot_size_label_beats_lots_in_description(self):
        body = """<h1>Dakota 6380 m2</h1><p>USD 1,465,000</p><p>SALE IN PROGRESS</p>
        <p>Five adjacent lots: Lot Number 809: 700 m2, Lot Number 977: 150 m2</p>
        <p>Lot size: 6.380 m2</p>"""
        r = read_listing("https://example.aw/l/3", body, 2.05)
        self.assertEqual(r["lot_m2"], 6380)
        self.assertEqual(r["status"], "sold/under contract")

    def test_jsonld_listing(self):
        body = """<html><head><script type="application/ld+json">
        {"@type":"RealEstateListing","name":"Lot","offers":{"price":"60000","priceCurrency":"USD"},
         "lotSize":{"value":1200,"unitCode":"MTK"}}</script></head>
        <body><h1>Long lease land, Santa Cruz</h1></body></html>"""
        r = read_listing("https://example.aw/l/2", body, 2.05)
        self.assertEqual(r["awg_per_lot_m2"], round(60000 * 1.79 / 1200, 1))
        self.assertEqual(r["tenure"], "leasehold")


if __name__ == "__main__":
    unittest.main()
