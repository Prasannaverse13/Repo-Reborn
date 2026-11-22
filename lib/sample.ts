// A small legacy shop used for demos. jQuery, old PHP, Python 2.
import type { RepoFile } from "./types";
import { groupOf, langOf } from "./github";

const raw: Record<string, string> = {
  "index.html": `<!DOCTYPE html>
<html>
<head>
  <title>Old Shop</title>
  <link rel="stylesheet" href="css/style.css">
  <script src="https://code.jquery.com/jquery-1.7.2.min.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/cart.js"></script>
  <script src="js/app.js"></script>
</head>
<body>
  <div id="header"><h1>Old Shop</h1><span id="cart-count">0</span></div>
  <div id="login">
    <input id="user" type="text"><input id="pass" type="password">
    <button onclick="doLogin()">Login</button>
  </div>
  <table id="products"></table>
</body>
</html>`,
  "js/utils.js": `var Utils = {};
Utils.formatPrice = function(p) {
  return "$" + parseFloat(p).toFixed(2);
};
Utils.getParam = function(name) {
  var results = new RegExp('[\\\\?&]' + name + '=([^&#]*)').exec(window.location.href);
  if (results == null) return null;
  return decodeURIComponent(results[1]);
};
Utils.each = function(arr, fn) {
  for (var i = 0; i < arr.length; i++) { fn(arr[i], i); }
};`,
  "js/cart.js": `function Cart() {
  this.items = [];
}
Cart.prototype.add = function(item) {
  var found = false;
  for (var i = 0; i < this.items.length; i++) {
    if (this.items[i].id == item.id) { this.items[i].qty++; found = true; }
  }
  if (!found) { item.qty = 1; this.items.push(item); }
  $("#cart-count").html(this.count());
};
Cart.prototype.count = function() {
  var c = 0;
  Utils.each(this.items, function(it) { c += it.qty; });
  return c;
};
Cart.prototype.total = function() {
  var t = 0;
  Utils.each(this.items, function(it) { t += it.qty * it.price; });
  return Utils.formatPrice(t);
};
var cart = new Cart();`,
  "js/app.js": `$(document).ready(function() {
  $.ajax({
    url: "api/products.php",
    type: "GET",
    dataType: "json",
    success: function(data) {
      var html = "";
      for (var i = 0; i < data.length; i++) {
        html += "<tr><td>" + data[i].name + "</td><td>" + Utils.formatPrice(data[i].price) +
          "</td><td><button class='add' data-i='" + i + "'>Add</button></td></tr>";
      }
      $("#products").html(html);
      $(".add").live("click", function() {
        cart.add(data[$(this).attr("data-i")]);
      });
    },
    error: function() { alert("Failed to load"); }
  });
});

function doLogin() {
  $.post("api/login.php", { user: $("#user").val(), pass: $("#pass").val() }, function(res) {
    if (res == "OK") { document.location = "index.html?welcome=1"; }
    else { alert("Bad login"); }
  });
}`,
  "api/db.php": `<?php
$conn = mysql_connect("localhost", "root", "root123");
mysql_select_db("shop", $conn);
?>`,
  "api/login.php": `<?php
include("db.php");
$user = $_POST['user'];
$pass = $_POST['pass'];
$res = mysql_query("SELECT * FROM users WHERE name='$user' AND pass='" . md5($pass) . "'");
if (mysql_num_rows($res) > 0) {
  session_start();
  $_SESSION['user'] = $user;
  echo "OK";
} else {
  echo "FAIL";
}
?>`,
  "api/products.php": `<?php
include("db.php");
$cat = $_GET['cat'];
$sql = "SELECT id, name, price FROM products";
if ($cat) { $sql .= " WHERE category = '$cat'"; }
$res = mysql_query($sql);
$rows = array();
while ($r = mysql_fetch_assoc($res)) { $rows[] = $r; }
echo json_encode($rows);
?>`,
  "api/orders.php": `<?php
include("db.php");
session_start();
if (!isset($_SESSION['user'])) { die("login first"); }
$items = json_decode($_POST['items']);
foreach ($items as $it) {
  mysql_query("INSERT INTO orders (user, product, qty) VALUES ('" . $_SESSION['user'] . "', " . $it->id . ", " . $it->qty . ")");
}
echo "saved";
?>`,
  "scripts/report.py": `import MySQLdb
import urllib2

def main():
    db = MySQLdb.connect("localhost", "root", "root123", "shop")
    cur = db.cursor()
    cur.execute("SELECT product, SUM(qty) FROM orders GROUP BY product")
    total = 0
    for row in cur.fetchall():
        print "Product %s sold %d" % (row[0], row[1])
        total += row[1]
    print "Total units:", total
    try:
        urllib2.urlopen("http://hooks.example.com/report?total=%d" % total)
    except Exception, e:
        print "hook failed", e

if __name__ == "__main__":
    main()`,
  "scripts/sync.py": `import csv
import MySQLdb

def sync(path):
    db = MySQLdb.connect("localhost", "root", "root123", "shop")
    cur = db.cursor()
    f = open(path, "rb")
    for row in csv.reader(f):
        if not row: continue
        cur.execute("UPDATE products SET price=%s WHERE id=%s" % (row[1], row[0]))
    db.commit()
    print "synced", path

if __name__ == "__main__":
    sync(raw_input("csv path: "))`,
  "css/style.css": `body { font-family: Verdana; background: #eee; }
#header { background: #336699; color: white; padding: 10px; }
#header h1 { float: left; margin: 0; }
#cart-count { float: right; background: red; padding: 2px 6px; border-radius: 3px; }
#products td { padding: 4px 10px; border-bottom: 1px solid #ccc; }
.add { background: #336699; color: #fff; border: 0; }`,
  "config.json": `{
  "dbHost": "localhost",
  "dbUser": "root",
  "dbPass": "root123",
  "currency": "USD",
  "debug": true
}`,
};

export const SAMPLE_NAME = "sample/old-shop";

export function sampleFiles(): RepoFile[] {
  return Object.entries(raw).map(([path, content]) => ({
    path,
    content,
    lang: langOf(path),
    size: content.length,
    group: groupOf(path),
  }));
}
