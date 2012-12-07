function pointEqual(x, y, x2, y2) {
  return (x >= x2 - 0.00005 && x <= x2 + 0.00005 &&
          y >= y2 - 0.00005 && y <= y2 + 0.00005);
}

function getAreaPoints(x, y, r, ir, areas, paper) {
  var ret = Raphael.newPathBuilder();

  // Reuleaux edge intersections
  var intersections = new Array();

  // Each circle has an array of intersections
  for (var i = 0; i < areas.count; i++) {
    var knob = areas[i];
    knob.intersections = new Array();
  }

  for (var i = 0; i < areas.count; i++) {
    var knob = areas[i];
    if (knob.area.next == undefined) {
      continue;
    }

    var kx = knob.x + x;
    var ky = knob.y + y;
    var kr = knob.radius;

    var isPointGood = function(point, j) {
      if (!reuleauxContains(x, y, r, point.x, point.y)) {
        return false;
      }

      // Does it alreay exist?
      if (point.circle != -1) {
        for (key in knob.intersections) {
          var intersection = knob.intersections[key];
          if (pointEqual(intersection.x, intersection.y, point.x, point.y) && intersection.circle == point.circle) {
            return false;
          }
        }
      }

      for (var k = 0; k < areas.count; k++) {
        if (k == j || k == i) {
          continue;
        }

        var knob3 = areas[k];
        var kx3 = knob3.x + x;
        var ky3 = knob3.y + y;
        var r3  = knob3.radius;
        if (circleContains(kx3, ky3, r3, point.x, point.y)) {
          return false;
        }
      }

      return true;
    }

    for (var j = 0; j < areas.count; j++) {
      if (j == i) {
        continue;
      }
      var knob2 = areas[j];
      var kx2 = knob2.x + x;
      var ky2 = knob2.y + y;
      var r2  = knob2.radius;
      var points = intersectCircleWithCircle(kx, ky, kr, kx2, ky2, r2);
      if (points) {
        for (key in points) {
          var point = points[key];
          // Reject points that are contained in other circles
          if (isPointGood(point, j)) {
            var intersection = {};
            intersection.x = point.x;
            intersection.y = point.y;
            intersection.circle = j;
            intersection.angle = getAngle(knob.x+x, knob.y+y, point.x, point.y);
            knob.intersections.push(intersection);
            var intersection2 = {};
            intersection2.x = point.x;
            intersection2.y = point.y;
            intersection2.circle = i;
            intersection2.angle = getAngle(knob2.x+x, knob2.y+y, point.x, point.y);
            knob2.intersections.push(intersection2);
          }
        }
      }
    }

    // Find intersections with this area and the outer reuleaux
    var points = intersectReuleauxWithCircle(x, y, r, kx, ky, kr);
    if (points) {
      for (key in points) {
        var point = points[key];
        // Reject points that are contained in other circles
        if (isPointGood(point, -1)) {
          var intersection = {};
          intersection.x = point.x;
          intersection.y = point.y;
          intersection.circle = -1; // Intersects reuleaux
          intersection.angle = getAngle(knob.x+x, knob.y+y, point.x, point.y);
          knob.intersections.push(intersection);
          var intersection2 = {};
          intersection2.x = point.x;
          intersection2.y = point.y;
          intersection2.circle = i;
          intersection2.angle = getAngle(x, y, point.x, point.y);
          intersections.push(intersection2);
        }
      }
    }
  }

  // Define the area
  var findNextRing = function() {
    // Find a starting place
    var startingArea = -1;
    for (var i = 0; i < areas.count; i++) {
      var knob = areas[i];
      var hasIntersections = false;
      for (key in knob.intersections) {
        hasIntersections = true;
        var point = knob.intersections[key];
        if (point.used == undefined) {
          knob.intersections[key].used = true;
          startingArea = i;
          break;
        }
      }
      if (!hasIntersections) {
        // It's just a single circle...
        // Render the single circle
        ret.moveTo(knob.x+x, knob.y+y-knob.radius);
        ret.circleArcTo(knob.x+x, knob.y+y+knob.radius, knob.radius, 0, 1); 
        ret.circleArcTo(knob.x+x, knob.y+y-knob.radius, knob.radius, 0, 1); 
        ret.close();
      }
      if (startingArea != -1) {
        break;
      }
    }

    if (startingArea == -1) {
      // Either entire area is covered, or none
      return false;
    }

    // Finds the corresponding intersection point in the adjacent region.
    var followPoint = function(point) {
      var points;
      if (point.circle == -1) {
        // Coast down the reuleaux!
        points = intersections;
      }
      else {
        points = areas[point.circle].intersections;
      }

      for (key in points) {
        var intersection = points[key];
        if (pointEqual(intersection.x, intersection.y, point.x, point.y)) {
          points[key].used = true;
          point = intersection;
          break;
        }
      }

      return point;
    }

    var findNextPoint = function(point) {
      var points;
      if (point.circle == -1) {
        // Coast down the reuleaux!
        points = intersections;
      }
      else {
        points = areas[point.circle].intersections;
      }

      var oldPoint = point;
      point = followPoint(point);
      var currentAngle = point.angle;

      if (oldPoint.circle == point.circle) {
        // wtf.
        point = oldPoint;
      }

      // Find next highest
      var next = point;
      var best = Math.PI * 2;
      for (key in points) {
        var intersection = points[key];
        var angle = intersection.angle;
        angle -= currentAngle;
        if (angle <= 0.00005) {
          angle += Math.PI * 2;
        }

        if (angle < best) {
          next = intersection;
          best = angle;
        }
      }

      next.angle_diff = best;
      return next;
    }

    // Determine starting direction by choosing the correct circle
    // So, it could produce an arc in one of two directions
    // The arc should not be contained within the circle next to it
    var area = areas[startingArea];
    var startingPoint = areas[startingArea].intersections[0];

    var cur_point = followPoint(startingPoint);
    var next_point = findNextPoint(startingPoint);
    var angle = cur_point.angle + 0.01;
    var circle = areas[startingPoint.circle];

    var mx = circle.x + x + circle.radius * Math.cos(angle);
    var my = circle.y + y + circle.radius * Math.sin(angle);

    ret.moveTo(mx, my-4);
    ret.circleArcTo(mx, my+4, 4, 0, 1);
    ret.circleArcTo(mx, my-4, 4, 0, 1);
    ret.close();
    if (circleContains(area.x+x, area.y+y, area.radius, mx, my)) {
      // No! Swap starting point
      startingPoint = cur_point;
    }

    var ringPoints = new Array();

    ringPoints.push({x: startingPoint.x, y: startingPoint.y});
    var currentPoint = startingPoint;
    var last_circle = startingArea;
    do {
      last_circle = currentPoint.circle;
      currentPoint = findNextPoint(currentPoint);
      if (last_circle == -1) {
        ringPoints.push({type: "reuleaux", x: currentPoint.x, y: currentPoint.y, rx: x, ry: y, r: r});
      }
      else {
        var area = areas[last_circle];
        var largearc = 0;
        if (currentPoint.angle_diff >= Math.PI - 0.00005) {
          largearc = 1;
        }
        ringPoints.push({type: "arc", x: currentPoint.x, y: currentPoint.y, r: area.radius, l: largearc});
      }
    } while (!pointEqual(currentPoint.x, currentPoint.y, startingPoint.x, startingPoint.y));

    return ringPoints;
  }

  while(true) {
    var ring = findNextRing();
    if (!ring) {
      break;
    }

    var renderRing = function(ring) {
      for (var index in ring) {
        var point = ring[index];
        /*    ret.moveTo(point.x, point.y-index);
              ret.circleArcTo(point.x, point.y+index, index, 0, 1);
              ret.circleArcTo(point.x, point.y-index, index, 0, 1);
              ret.close();*/
      }

      for (var index in ring) {
        var point = ring[index];

        if (index == 0) {
          ret.moveTo(point.x, point.y);
        }
        else if (point.type == "reuleaux") {
          ret.reuleauxArcTo(point.rx, point.ry, point.x, point.y, point.r, 1);
        }
        else {
          ret.circleArcTo(point.x, point.y, point.r, 1, point.l);
        }
      }

      ret.close();
    }

    renderRing(ring);
  }

  return ret;
}

function circleContains(x, y, r, px, py) {
  var d = computeDistance(x, y, px, py);
  return (d <= r + 0.00005);
}

function intersectReuleauxWithCircle(x, y, r, cx, cy, cr) {
  var points = getPoints(x, y, r);

  // Determine if line intersects any of the circles that make
  // up the Reuleaux.

  // Find the radius of the outer circles
  var cir_r = 2 * r * r * (1 - Math.cos((2/3) * Math.PI));
  cir_r = Math.sqrt(cir_r);

  // Clip line with every circle that makes up the Reuleaux
  var intersectionPoints = new Array();
  for (var i = 0; i < 3; i++) {
    var tmpline = intersectCircleWithCircle(points[i].x, points[i].y, cir_r, cx, cy, cr);
    if (tmpline) {
      for (index in tmpline) {
        intersectionPoints.push(tmpline[index]);
      }
    }
  }

  // Check to see that all points are within the reuleaux
  var ret = new Array();
  for (index in intersectionPoints) {
    if (reuleauxContains(x, y, r, intersectionPoints[index].x, intersectionPoints[index].y)) {
      ret.push(intersectionPoints[index]);
    }
  }

  return ret;
}

function intersectCircleWithCircle(x1, y1, r1, x2, y2, r2) {
  var d = computeDistance(x1, y1, x2, y2);

  if (d > (r1+r2) || d < Math.abs(r1-r2) || (d == 0 && r1 == r2)) {
    // Either the circles do not overlap, or one is contained within the other.
    return false;
  }

  var points = new Array();

  // The distance from the first circle and the midpoint (cx, cy)
  var a = ((r1*r1) - (r2*r2) + (d*d)) / (2*d);

  // Midpoint between two circles, the normal of this line contains both points
  var cx = x1 + (a * (x2 - x1) / d);
  var cy = y1 + (a * (y2 - y1) / d);

  if (d > (r1+r2-0.00005) && d < (r1+r2+0.00005)) {
    // One point: the midpoint is the point which both circles touch
    var point = {x: cx, y: cy};
    points.push(point);
    return points;
  }

  // Two points

  // The distance between the midpoint (cx, cy) and the intersection points
  var h = Math.sqrt((r1*r1) - (a*a));

  // Each intersection point
  var p1 = {x: cx + (h * (y2 - y1) / d), y: cy - (h * (x2 - x1) / d)};
  var p2 = {x: cx - (h * (y2 - y1) / d), y: cy + (h * (x2 - x1) / d)};

  points.push(p1);
  points.push(p2);

  return points;
}

function computeDistance(x, y, x2, y2) {
  var dx = x - x2;
  var dy = y - y2;

  var n = dx * dx + dy * dy;

  return Math.sqrt(n);
}

function PathBuilder() {
  this.pathstr = "";
  this.x = 0;
  this.y = 0;

  this.close = function() {
    this.pathstr += "z";
  }

  this.moveTo = function(x, y) {
    this.pathstr += "M" + x + " " + y;
    this.x = x;
    this.y = y;
  }

  this.lineTo = function(x, y) {
    this.pathstr += "L" + x + " " + y;
    this.x = x;
    this.y = y;
  }

  this.reuleauxArcTo = function(x, y, px, py, r, reverse) {
    r = r || 1;

    var startAngle = getAngle(x, y, this.x, this.y);
    var endAngle   = getAngle(x, y, px, py);

    if (startAngle > endAngle) {
      endAngle += Math.PI * 2;
    }

    if (reverse) {
      var tmp = startAngle;
      startAngle = endAngle;
      endAngle = tmp;
    }

    var cir_r = 2*r*r*(1-Math.cos(2/3*Math.PI));
    cir_r = Math.sqrt(cir_r);

    var points = getPoints(x,y,r);

    // Determine start point from angle
    var start_focal = 0;
    var constrainedStartAngle = startAngle % (Math.PI*2);
    if (constrainedStartAngle < 0) {
      constrainedStartAngle += Math.PI*2;
    }
    if (constrainedStartAngle >= (Math.PI * 3 / 2) && constrainedStartAngle <= (Math.PI * 2)) {
      start_focal = 1;
    }
    else if (constrainedStartAngle >= 0.0 && constrainedStartAngle <= (Math.PI / 6)) {
      start_focal = 1;
    }
    else if (constrainedStartAngle >= (Math.PI / 6) && constrainedStartAngle <= (Math.PI * 5 / 6)) {
      start_focal = 0;
    }
    else {
      start_focal = 2;
    }

    var startPoint = intersectCircle(points[start_focal], cir_r, x, y, x + cir_r * Math.cos(startAngle), y + cir_r * Math.sin(startAngle))[0];

    var end_focal = 0;
    var constrainedEndAngle = endAngle % (Math.PI*2);
    if (constrainedEndAngle < 0) {
      constrainedEndAngle += Math.PI*2;
    }
    if (constrainedEndAngle >= (Math.PI * 3 / 2) && constrainedEndAngle <= (Math.PI * 2)) {
      end_focal = 1;
    }
    else if (constrainedEndAngle >= 0.0 && constrainedEndAngle <= (Math.PI / 6)) {
      end_focal = 1;
    }
    else if (constrainedEndAngle >= (Math.PI / 6) && constrainedEndAngle <= (Math.PI * 5 / 6)) {
      end_focal = 0;
    }
    else {
      end_focal = 2;
    }

    var endPoint = intersectCircle(points[end_focal], cir_r, x, y, x + cir_r * Math.cos(endAngle), y + cir_r * Math.sin(endAngle))[0];

    var pathstr = "";
    var sweep = 0;
    var i = start_focal;
    if (endAngle < startAngle) {
      var sweep = 1;
      var i = end_focal;
      while (((i+3) % 3) != start_focal) {
        var focal = points[(i+1)%3];
        this.circleArcTo(focal.x, focal.y, cir_r, sweep);
        i--;
      }
      this.circleArcTo(startPoint.x, startPoint.y, cir_r, sweep);
    }
    else {
      var sweep = 0;
      var i = start_focal;
      while (((i+3) % 3) != end_focal) {
        var focal = points[(i-1+3)%3];
        this.circleArcTo(focal.x, focal.y, cir_r, sweep);
        i++;
      }
      this.circleArcTo(endPoint.x, endPoint.y, cir_r, sweep);
    }

    this.x = x;
    this.y = y;
  }

  this.circleArcTo = function(x, y, r, sweep, largearc) {
    if (r == undefined) {
      r = 1;
    }

    if (sweep == undefined) {
      sweep = 0;
    }

    if (largearc == undefined) {
      largearc = 0;
    }
    this.pathstr += "A" + [r, r, 0, largearc, sweep, x, y].join(',');

    this.x = x;
    this.y = y;
  }

  this.ellipseArcTo = function(x, y, rx, ry, sweep) {
    if (rx == undefined) {
      rx = 1;
    }

    if (ry == undefined) {
      ry = 1;
    }

    if (sweep == undefined) {
      sweep = 0;
    }
    this.pathstr += "A" + [rx, ry, 0, 0, sweep, x, y].join(',');

    this.x = x;
    this.y = y;
  }
}

Raphael.newPathBuilder = function() {
  return new PathBuilder();
}

Raphael.fn.pathFromBuilder = function(builder) {
  return this.path(builder.pathstr);
}

function getReuleauxArcPathStringPoints(x, y, r, px, py, tx, ty) {
  // Get angles of px, py

  start = getAngle(x, y, px, py);
  end = getAngle(x, y, tx, ty);
  return getReuleauxArcPathString(x, y, r, start, end);
}

function getReuleauxArcPathString(x, y, r, startAngle, endAngle) {
  r = r || 1;

  var cir_r = 2*r*r*(1-Math.cos(2/3*Math.PI));
  cir_r = Math.sqrt(cir_r);

  var points = getPoints(x,y,r);

  // Determine start point from angle
  var start_focal = 0;
  var constrainedStartAngle = startAngle % (Math.PI*2);
  if (constrainedStartAngle < 0) {
    constrainedStartAngle += Math.PI*2;
  }
  if (constrainedStartAngle >= (Math.PI * 3 / 2) && constrainedStartAngle <= (Math.PI * 2)) {
    start_focal = 1;
  }
  else if (constrainedStartAngle >= 0.0 && constrainedStartAngle <= (Math.PI / 6)) {
    start_focal = 1;
  }
  else if (constrainedStartAngle >= (Math.PI / 6) && constrainedStartAngle <= (Math.PI * 5 / 6)) {
    start_focal = 0;
  }
  else {
    start_focal = 2;
  }

  var startPoint = intersectCircle(points[start_focal], cir_r, x, y, x + cir_r * Math.cos(startAngle), y + cir_r * Math.sin(startAngle))[0];

  var end_focal = 0;
  var constrainedEndAngle = endAngle % (Math.PI*2);
  if (constrainedEndAngle < 0) {
    constrainedEndAngle += Math.PI*2;
  }
  if (constrainedEndAngle >= (Math.PI * 3 / 2) && constrainedEndAngle <= (Math.PI * 2)) {
    end_focal = 1;
  }
  else if (constrainedEndAngle >= 0.0 && constrainedEndAngle <= (Math.PI / 6)) {
    end_focal = 1;
  }
  else if (constrainedEndAngle >= (Math.PI / 6) && constrainedEndAngle <= (Math.PI * 5 / 6)) {
    end_focal = 0;
  }
  else {
    end_focal = 2;
  }

  var endPoint = intersectCircle(points[end_focal], cir_r, x, y, x + cir_r * Math.cos(endAngle), y + cir_r * Math.sin(endAngle))[0];

  var pathstr = "";
  var builder = Raphael.newPathBuilder();
  if (endAngle < startAngle) {
    builder.moveTo(endPoint.x, endPoint.y);

    var sweep = 1;
    var i = end_focal;
    while (((i+3) % 3) != start_focal) {
      var focal = points[(i+1)%3];
      builder.circleArcTo(focal.x, focal.y, cir_r, sweep);
      i--;
    }
    builder.circleArcTo(startPoint.x, startPoint.y, cir_r, sweep);
  }
  else {
    builder.moveTo(startPoint.x, startPoint.y);

    var sweep = 0;
    var i = start_focal;
    while (((i+3) % 3) != end_focal) {
      var focal = points[(i-1+3)%3];
      builder.circleArcTo(focal.x, focal.y, cir_r, sweep);
      i++;
    }
    builder.circleArcTo(endPoint.x, endPoint.y, cir_r, sweep);
  }
  
  return builder;
}

function getReuleauxPathString(x, y, r, reverse) {
  r = r || 1;
  if (reverse == undefined) {
    reverse = false;
  }

  var cir_r = 2*r*r*(1-Math.cos(2/3*Math.PI));
  cir_r = Math.sqrt(cir_r);

  var points = getPoints(x,y,r);

  var pathstr = "M" + points[0].x + " " + points[0].y;

  var sweep = 0;
  if (reverse) {
    sweep = 1;
  }

  for (var i = 0; i < 3; i++) {
    var point_index = (i + 1) % 3;
    if (reverse) {
      point_index = (3 - i - 1);
    }
    var next_point = points[point_index];
    pathstr += "A" + [cir_r, cir_r, 0, 0, sweep, next_point.x, next_point.y].join(',');
  }
  pathstr += "z";

  return pathstr;
}

Raphael.fn.prettyReuleauxRing = function(x, y, r, ir, caption, labels) {
  r  = r || 1;
  ir = ir || 1;

  var outer_pathstr = getReuleauxPathString(x, y, r);
  var inner_pathstr = getReuleauxPathString(x, y, ir);
  var fill_pathstr = outer_pathstr + getReuleauxPathString(x, y, ir, true);

  var ret = {};
  ret.center = {x: x, y: y};

  ret.reuleaux = this.path(fill_pathstr);

  var stripe_height = 18;
  var offset = 15;

  var lines = new Array();
  var line_count = 0;
  for (var i = -6; i < 7; i++) {
    lines.push({x1: x + r, y1: y - r + (i * stripe_height) + offset,
                x2: x - r, y2: y + r + (i * stripe_height) + offset});
    line_count++;
  }

  var points = getPoints(x, y, r);
  var stripes = new Array();
  var stripe_count = 0;
  for (var i = 0; i < line_count; i+=2) {
    var line1 = lines[i];
    var line2 = {};
    if ((i + 1) < line_count) {
      line2 = lines[i+1];
    }
    else {
      line2 = {x1: points[2].x, y1: points[2].y,
               x2: points[2].x, y2: points[2].y};
    }
    var stripe = {};
    stripe.top1 = line1;
    stripe.bottom1 = line2;
    stripes.push(stripe);

    stripe_count++;
  }

  var clipLineToOuter = function(line) {
    intersectionPoints = intersectReuleaux(x, y, line.x1, line.y1, line.x2, line.y2, r);
    if (intersectionPoints) {
      line.x1 = intersectionPoints[0].x;
      line.y1 = intersectionPoints[0].y;
      line.x2 = intersectionPoints[1].x;
      line.y2 = intersectionPoints[1].y;
    }
    return line;
  }

  var clipLineToInner = function(line) {
    intersectionPoints = intersectReuleaux(x, y, line.x1, line.y1, line.x2, line.y2, ir);
    var ret = new Array();
    if (intersectionPoints) {
      // Ok. Subset of the line means adding a new line
      var new_line = {};
      new_line.x1 = intersectionPoints[1].x;
      new_line.y1 = intersectionPoints[1].y;
      new_line.x2 = line.x2;
      new_line.y2 = line.y2;
      // Truncate old line to go up to the inner reuleaux
      line.x2 = intersectionPoints[0].x;
      line.y2 = intersectionPoints[0].y;

      ret.push(line);
      ret.push(new_line);
    }
    else {
      ret.push(line);
    }
    return ret;
  }

  for (var i = 0; i < stripe_count; i++) {
    var stripe = stripes[i];
    stripe.top1 = clipLineToOuter(stripe.top1);
    var lines = clipLineToInner(stripe.top1);
    if (lines[1] != undefined) {
      stripe.top1 = lines[0];
      stripe.top2 = lines[1];
    }

    stripe.bottom1 = clipLineToOuter(stripe.bottom1);
    var lines = clipLineToInner(stripe.bottom1);
    if (lines[1] != undefined) {
      stripe.bottom1 = lines[0];
      stripe.bottom2 = lines[1];
    }

    stripes[i] = stripe;
  }

  var stripePath = Raphael.newPathBuilder();
  for (var i = 0; i < stripe_count; i++) {
    var stripe = stripes[i];
    var pathstr = "";
    stripePath.moveTo(stripe.top1.x1, stripe.top1.y1);
    stripePath.lineTo(stripe.top1.x2, stripe.top1.y2);
    if (stripe.top2 != undefined) {
      stripePath.reuleauxArcTo(x, y, stripe.top2.x1, stripe.top2.y1, ir, 1);
      stripePath.lineTo(stripe.top2.x2, stripe.top2.y2);
    }
    if (stripe.bottom2 != undefined) {
      stripePath.reuleauxArcTo(x, y, stripe.bottom2.x2, stripe.bottom2.y2, r, 0);
      stripePath.lineTo(stripe.bottom2.x1, stripe.bottom2.y1);
      stripePath.reuleauxArcTo(x, y, stripe.bottom1.x2, stripe.bottom1.y2, ir, 1);
      stripePath.lineTo(stripe.bottom1.x1, stripe.bottom1.y1);
    }
    else {
      stripePath.reuleauxArcTo(x, y, stripe.bottom1.x2, stripe.bottom1.y2, r, 0);
      stripePath.lineTo(stripe.bottom1.x1, stripe.bottom1.y1);
    }
    stripePath.reuleauxArcTo(x, y, stripe.top1.x1, stripe.top1.y1, r, 0);
    stripePath.close();
    //this.circle(lines[i].x2, lines[i].y2, 5);
  }
  ret.stripe = this.pathFromBuilder(stripePath).attr({stroke: "#ffa9f7", fill: "#fbf"});

  font_attr = {"font-size": 16, fill: "#c359a4", stroke: "#c359a4"};
  caption_attr = {"font-size": 10, fill: "#c359a4"};

  ret.labels = {};
  ret.labels.middle = this.text(x,y-2,labels.middle).attr(font_attr).attr({"stroke-width": 0.1, "font-size": 17});
  ret.labels.top    = this.text(x-(0.01*r),17+(y-r), labels.top).attr(font_attr).attr({"stroke-width": 0.1, "font-size":18});
  ret.labels.left   = this.text((0.30*r)+(x-r),(0.40*r)+y,labels.left).attr(font_attr);
  ret.labels.right  = this.text((0.70*r)+x,(0.40*r)+y, labels.right).attr(font_attr);

  ret.caption = this.text(x,(0.9*r)+y,caption).attr(caption_attr);
  
  ret.outer_border = this.path(outer_pathstr);
  ret.inner_border = this.path(inner_pathstr);

  ret.reuleaux.attr({fill: "#fcf", "stroke-opacity": 0.0});

  ret.outer_border.attr({"fill-opacity": 0.0, stroke: "#a74d8c", "stroke-width": 1.8});
  ret.inner_border.attr({"fill-opacity": 0.0, stroke: "#c359a4", "stroke-width": 1.5});
  ret.knob = this.circle(x, y, 4).attr({"opacity": 0.0, fill: "#888", stroke: "#fcf", "stroke-width": 1.8});

  ret.set_knob = function(nx, ny) {
    this.knob.attr({opacity: 1.0});
    this.knob.attr({cx: this.center.x + nx, cy: this.center.y + ny});
  }

  return ret;
}

Raphael.fn.reuleauxRing = function(x, y, r, ir) {
  r  = r  || 1;
  ir = ir || 1;

  var pathstr  = getReuleauxPathString(x, y, r);
  pathstr     += getReuleauxPathString(x, y, ir, true);

  return this.path(pathstr);
}

Raphael.fn.reuleaux = function(x, y, r) {
  r = r || 1;

  var pathstr = getReuleauxPathString(x, y, r);

  return this.path(pathstr);
};

function getAngle(x, y, endx, endy) {
  var nx = endx-x;
  var ny = y-endy;

  ang  = Math.atan2(nx, ny);
  ang -= Math.PI / 2;

  ang += 2*Math.PI;
  ang %= 2*Math.PI;

  return ang;
}

// Returns an array of 3 points that define the corners of the Reuleaux
function getPoints(x,y,r) {
  r = r || 1;

  var points = new Array();
  points[0] = {x:x,y:y-r};

  var diff_x = r * 0.5 * Math.sqrt(3);
  points[1] = {x:x-diff_x,y:y+(0.5 * r)};
  points[2] = {x:x+diff_x,y:points[1].y};

  return points;
}

// Adds a area selector knob at the given coordinates.
// paper: Raphael canvas
// selector: A Reuleaux selector object
// x,y: coordinates to place the knob
function addAreaKnob(paper, selector, x, y) {
  if (selector.knobs == undefined) {
    selector.knobs = new Array();
    selector.knobs.count = 0;
  }

  var knob = {};
  knob.radius = 5;
  knob.x = 0;
  knob.y = 0;
  knob.area = paper.circle(x,y,knob.radius).attr({"stroke-opacity": 0.0, fill: "#44f", "fill-opacity": 0.5});
  knob.move_handle = paper.circle(x,y,5).attr({stroke: "#AA88AA", "stroke-width": 2, fill: "#fff", "fill-opacity": 0.0});
  knob.moved = false;

  var distance = knob.radius * Math.sqrt(2) * 0.5;
  knob.scale_handle = paper.circle(x + distance, y + distance,3).attr({fill: "#333", "fill-opacity": 0.6, "stroke-opacity": 0.0});

  knob.move_handle.drag(
      // on move
      function (dx, dy) {
        var newx = this.ox + dx;
        var newy = this.oy + dy;

        this.attr({cx: newx, cy: newy});

        knob.x = newx - x;
        knob.y = newy - y;

        distance = knob.radius * Math.sqrt(2) * 0.5;
        knob.scale_handle.attr({cx: newx+distance, cy: newy+distance});
        knob.area.attr({cx: newx, cy: newy});
        if (!knob.moved) {
          addAreaKnob(paper, selector, x, y);
          knob.moved = true;
        }

        this.attr({opacity: 0.5});
        selector.updated(selector.knobs);
      },
      // on start
      function() {
        // storing original coordinates
        this.ox = this.attr("cx");
        this.oy = this.attr("cy");

        this.attr({opacity: 0.5});
      },
      // when done
      function() {
        this.attr({opacity: 1.0});
      });

  knob.scale_handle.drag(
    // on move
    function (dx, dy) {
      // determine distance to area center, establish as knob_radius
      var newx = this.ox + dx;
      var newy = this.oy + dy;

      var centerx = knob.move_handle.attr("cx");
      var centery = knob.move_handle.attr("cy");

      var distance = (newx - centerx) * (newx - centerx);
      distance = distance + (newy - centery) * (newy - centery);
      distance = Math.sqrt(distance);

      if (knob.moved == false && distance < 5) {
        distance = 5;
      }

      knob.radius = distance;

      knob.area.attr({r: distance});

      distance = knob.radius * Math.sqrt(2) * 0.5;

      this.attr({cx: centerx+distance, cy: centery+distance});
      selector.updated(selector.knobs);
    },
    // on start
    function () {
      this.ox = this.attr("cx");
      this.oy = this.attr("cy");
    },
    // on end
    function () {
      if (knob.radius < 5 && knob.moved) {
        // destroy
        knob.area.remove();
        knob.move_handle.remove();
        knob.scale_handle.remove();
      }
    }
  );

  selector.knobs.push(knob);
  selector.knobs.count++;

  for(var i = 0; i < selector.knobs.length; i++) {
    selector.knobs[i].move_handle.toFront();
    selector.knobs[i].scale_handle.toFront();
  }
}

// Draws the selector
// paper: canvas
// x, y: coordinate to position the center of the selector
// size: radius of the reuleaux
// attr_outer: style of outer reuleaux
// caption: text that appears under the selector
// labels: hash of labels for corners and center
//				 ex: {middle: "none", top: "all", left: "female", right: "male"}
// Rest are optional...
// start_x, start_y: value of knob (when not given, set to x,y)
// is_point_selector: true when it is a point selector, false when it is an area selector (default: true)
// inner_size: relative size of center hole (when not given, set to 0.17)
function drawSelector(paper, x, y, size, attr_outer, caption, labels, start_x, start_y, is_point_selector, inner_size) {
  var tri_fit = 1.0;
  if (inner_size == undefined) inner_size = 0.17;
  if (is_point_selector == undefined) is_point_selector = true;

  var selector = {};

  selector.center = {x: x, y: y};

  selector.update = function(x,y) {
  };

  selector.tris = {};
  var radius = size*tri_fit;
  var inner_radius = radius * inner_size;
  selector.tris.outer = paper.reuleauxRing(x, y, radius, inner_radius).attr(attr_outer);
  selector.tris.inner = paper.reuleaux(x, y, inner_radius).attr({opacity: 0.0});

  // draw non-colliding gender labels
  // TODO: make these coords relative to the size! scale if necessary!
  selector.labels = {};
  selector.labels.middle = paper.text(x,y,labels.middle)
    selector.labels.top = paper.text(x,20+(y-size), labels.top)
    selector.labels.left = paper.text((0.40*size)+(x-size),(0.40*size)+y,labels.left)
    selector.labels.right = paper.text((0.65*size)+x,(0.40*size)+y, labels.right)
    selector.caption = paper.text(x,(0.8*size)+y,caption);

  // Set knob coords
  if (start_x) {
    selector.x = start_x - x;
  }
  else {
    selector.x = 0;
  }

  if (start_y) {
    selector.y = start_y - y;
  }
  else {
    selector.y = 0;
  }

  if (is_point_selector) {
    // an event for when the knob moves (initially, do nothing)
    selector.updated = function(x,y) {};

    // selector
    selector.knob = paper.circle(x + selector.x, y + selector.y,5).attr({stroke: "#AA88AA", "stroke-width": 2, fill: "#fff", "fill-opacity": 0.0});

    // add drag events to knob

    // What happens when the knob is dragged
    selector.knob.drag(
      // on move
      function (dx, dy) {
        var newx = this.ox + dx;
        var newy = this.oy + dy;

        // Snap to the middle of the small Reuleaux if inside
        if(selector.tris.inner.isPointInside(newx, newy)) {
          newx = x;
          newy = y;
        }
        else if(!selector.tris.outer.isPointInside(newx, newy)) {
          intersectionPoints = intersectReuleaux(x, y, x, y, newx, newy, size);
          if (intersectionPoints) {
            newx = intersectionPoints[0].x;
            newy = intersectionPoints[0].y;
          }
        }
  
        this.attr({cx: newx, cy: newy});

        this.attr({opacity: 0.5});
        selector.x = newx - x;
        selector.y = newy - y;
        selector.updated(selector.x, selector.y);
      },
      // on start
      function() {
        // storing original coordinates
        this.ox = this.attr("cx");
        this.oy = this.attr("cy");
        this.attr({opacity: 0.5});
      },
      // when done
      function() {
        this.attr({opacity: 1.0});
      }
    );
  }
  else {
    // an event for when the area changes, initially do nothing
    selector.updated = function(knobs) {};

    var half_width  = size;
    var half_height = size;
    addAreaKnob(paper, selector, x+selector.x, y+selector.y);
  }

  return selector;
}

// Returns: The point of intersection of a line and a circle.
// Assumes: The line only intersects at one point
// focal: The center of the circle
// cir_r: The circle radius
// newx,newy: The start of the line
// endx,endy: The end of the line
function intersectCircle(focal, cir_r, newx, newy, endx, endy, clipLine) {
  if (clipLine == undefined) {
    clipLine = false;
  }

  // Transform such that the center of the circle is the origin
  var fx = focal.x;
  var fy = focal.y;

  var nx = newx - fx;
  var ny = fy - newy;

  var cx = endx - fx;
  var cy = fy - endy;

  // The focal point is the center, and the origin now
  fx = 0;
  fy = 0;

  // scale down
  fx /= cir_r;
  fy /= cir_r;
  cx /= cir_r;
  cy /= cir_r;
  nx /= cir_r;
  ny /= cir_r;

  // intersect line with circle
  // circle is unit radius thanks to scaling, and at origin
  // CIRCLE: 1 = x^2 + y^2

  // Parametric equations for the line are needed
  // P(x,y) = StartPoint + t*Dir(x,y)

  // Good ole direction vector
  var dx,dy;
  dx = cx-nx;
  dy = cy-ny;

  // COOL!
  // Px = nx+t*dx
  // Py = ny+t*dy

  // We have some vector for the Ray from center of circle
  // to the end point (nx,ny)
  var gx = nx-fx;
  var gy = ny-fy;

  // Substitute in for x and y... do a lot of math... end up with:
  // 	t^2*(Dir . Dir) + 2*t*(Dir . Ray) + (Ray . Ray) - r^2 = 0

  // Solve with the good ole quadratic formula
  var a = (dx*dx)+(dy*dy); // Dir . Dir
  var b = 2*((gx*dx) + (gy*dy)); // Ray . Dir
  var c = (gx*gx)+(gy*gy) - 1*1; // (Ray . Ray) - r^2

  var discriminate = b*b - 4*a*c;
  if (discriminate < 0) {
    // no solutions
    return false;
  }
  else if (discriminate == 0) {
    // one solution
  }
  else {
    // two solutions
  }

  discriminate = Math.sqrt(discriminate);

  var t1 = (-b + discriminate)/(2*a);
  var t2 = (-b - discriminate)/(2*a);

  if (t1 > t2) {
    var tmpt = t1;
    t1 = t2;
    t2 = tmpt;
  }

  if (t1 < 0.0 && clipLine) { t1 = 0.0; }
  if (t2 > 1.0 && clipLine) { t2 = 1.0; }

  // Go back to our actual coordinate system
  nx = newx;
  ny = newy;
  dx = endx-nx;
  dy = endy-ny;

  // Intersection point
  var x1 = nx+t1*dx;
  var y1 = ny+t1*dy;
  var x2 = nx+t2*dx;
  var y2 = ny+t2*dy;

  var points = new Array();
  var has_point = false;

  // It just so happens that this is the correct point!
  // We can throw away the other intersection point
  if (endx < newx) {
    var tmpx = newx;
    newx = endx;
    endx = tmpx;
  }

  if (endy < newy) {
    var tmpy = newy;
    newy = endy;
    endy = tmpy;
  }

  if (clipLine || t1 >= 0.0) {
    points.push({x:x1, y:y1, t: t1});
    has_point = true;
  }

  if (clipLine || t2 <= 1.0) {
    points.push({x:x2, y:y2, t: t2});
    has_point = true;
  }

  if (has_point) {
    return points;
  }

  return false;
}

// Returns: The point where the given line intersects a Reuleaux of the given
//          size.
// Assumes: The line starts at the center of the Reuleaux.
// x,y: The center of the Reuleaux
// startx,endy: The start point of the line
// endx,endy: The end point of the line
// size: The radius of the Reuleaux.
function intersectReuleaux(x, y, startx, starty, endx, endy, size) {
  var points = getPoints(x, y, size);

  // Determine if line intersects any of the circles that make
  // up the Reuleaux.

  // Find the radius of the outer circles
  var cir_r = 2 * size * size * (1 - Math.cos((2/3) * Math.PI));
  cir_r = Math.sqrt(cir_r);

  // Clip line with every circle that makes up the Reuleaux
  var line = new Array();
  line.push({x: startx, y: starty});
  line.push({x: endx,   y: endy});
  for (var i = 0; i < 3; i++) {
    var tmpline = intersectCircle(points[i], cir_r, line[0].x, line[0].y, line[1].x, line[1].y, true);
    if (tmpline) {
      line = tmpline;
    }
  }

  points = new Array();
  if (line[0].t >= 0.0) {
    points.push(line[0]);
  }
  else {
    return false;
  }

  if (line[1].t <= 1.0) {
    points.push(line[1]);
  }

  // Check to see that both points are within the reuleaux
  if (!reuleauxContains(x, y, size, points[0].x, points[0].y)) {
    return false;
  }

  return points;
}

function reuleauxContains(x, y, r, checkx, checky) {
  var points = getPoints(x, y, r);

  // Determine if line intersects any of the circles that make
  // up the Reuleaux.

  // Find the radius of the outer circles
  var cir_r = 2 * r * r * (1 - Math.cos((2/3) * Math.PI));
  cir_r = Math.sqrt(cir_r);

  var ret = true;
  for (var i = 0; i < 3; i++) {
    ret &= circleContains(points[i].x, points[i].y, cir_r, checkx, checky);
  }

  return ret;
}

// Returns: The equivalent point on a triangle that matches the Reuleaux.
// newx,newy: The point.
// x,y: The center of the Reuleaux
// size: The radius of the Reuleaux
// size_inner: The percentage difference of the inner Reuleaux to the outer.
function transformPoint(newx, newy, x,y,size,size_inner) {
  // Transform
  // Need the distance normal to the inner reuleaux

  /*

     Consider a third:

     .*
     .` |      *---.---*---*
     .   |      ^   |   ^   ^- center point
     /    |      |   |   ------ boundary of inner reuleaux
     `    .`      |   ---------- point of concern
     `    . |      -------------- boundary of outer reuleaux
     .    _`-*
     | _-`
   *`

   Distance from boundary of inner reuleaux to inner focal point
   is the radius of the inner circle (icr)

   Distance from the boundary of the outer reuleaux to outer focal
   point is the radius of the outer circle (ocr)

   The line from the point of concern to the opposite focal point
   is also normal to both reuleaux curves.

   We will get the angle and then the distance from the point of
   concern to the boundary of the inner reuleaux and divide that
   into the total distance of the normal line between the inner
   and outer reuleaux triangles.

*/

  // Need the angle from the internal center

  // Angle between two vectors (one from point of concern to center,
  // other from focal point to center) is simply:
  // arccos((a . b) / (|a|*|b|))
  var points = getPoints(x,y,size);
  focal = points[0];

  // Make the center of the reuleaux the origin
  nx = newx-x;
  ny = y-newy;

  fx = focal.x-x;
  fy = y-focal.y;

  // Find the distance from the point of concern to the center
  d = Math.sqrt(nx*nx+ny*ny);

  var cx,cy;

  // Find the distance from the focal point to the center
  var l = Math.sqrt(fx*fx+fy*fy);

  // Get the angle between the two vectors
  var dot = (nx*fx)+(ny*fy);
  var mag = (d*l);
  var ang = Math.acos(dot/mag);

  // Take into account angles > 180 degrees
  if (nx > fx) ang = (2*Math.PI)-ang;

  var tx, ty;

  // Find the radius of the outer circles
  var cir_r = 2*size*size*(1-Math.cos(2/3*Math.PI));
  cir_r = Math.sqrt(cir_r);

  // Find the radius of the inner circles
  var cir_r_inner = 2*size_inner*size_inner*(1-Math.cos(2/3*Math.PI));
  cir_r_inner = Math.sqrt(cir_r_inner);

  var x1,y1,x2,y2;

  // origin is at focal point of concern
  // We need to know which quadrant we are in (ok, yeah, of the *three*)
  // But, hey! We know the angle!

  var q = 0;
  if (ang >= 0 && ang <= (2/3)*Math.PI) {
    q = 2;
  }
  else if (ang >= (2/3)*Math.PI && ang <= (4/3)*Math.PI) {
    q = 0;
  }
  else {
    q = 1;
  }

  // Get angle within the 'quadrant'
  var max_angle = (2/3)*Math.PI * (((q+1)%3)+1);
  var inner_ang = max_angle - ang;

  // Ok, We pick the circle from the quadrant.
  focal = points[q];

  // Find intersection with outer reuleaux
  var outerPoint = intersectCircle(focal, cir_r, newx, newy, x, y)[0];

  var inner_points = getPoints(x,y,size_inner);
  focal = inner_points[q];

  // Do the same for the inner reuleaux... painfully
  var innerPoint = intersectCircle(focal, cir_r_inner, newx, newy, x, y)[0];

  // Find the distance between the two intersection points.
  // This is the length between the inner and outer reuleaux
  dx = (innerPoint.x-outerPoint.x);
  dx = dx * dx;

  dy = (innerPoint.y-outerPoint.y);
  dy = dy * dy;

  d = Math.sqrt(dx+dy);

  // Also find the distance from the point of concern to the inner
  // reuleaux.
  fx = (newx-innerPoint.x);
  fx = fx * fx;

  fy = (newy-innerPoint.y);
  fy = fy * fy;

  var f = Math.sqrt(fx + fy);

  // How far from the center to the edge normal to the curve are we?
  // We then go that far along the diagonal of the triangle for 
  // our transformation.
  var diff = f / d;

  // Are we in the inner reuleaux?
  // Collision is easy, make sure distance from point to center
  // of each of the three defining circles is greater than the radius
  var in_inner = true;
  for(var i=0;i<3;i++) {
    dx = (newx-inner_points[i].x);
    dx = dx * dx;
    dy = (newy-inner_points[i].y);
    dy = dy * dy;
    d = Math.sqrt(dx+dy);

    if (d >= cir_r_inner) {
      in_inner = false;
      break;
    }
  }

  // Find the point on the boundary of the triangle that is normal
  // to the triangle edge and goes through the centroid point

  dx = (points[0].x - x);
  dx = dx * dx;

  dy = (points[0].y - y);
  dy = dy * dy;

  // The length of the proper triangle's radius
  d = Math.sqrt(dx+dy);

  /*
     LAW OF SINES

     ,/
     -`/ <-- angle is inner_ang
     d -` / r
     -`  /
     /--> -` ,,- <--- angle is PI - inner_ang - PI/6
     PI/6 ..--``

     r = d * sin(PI/6) / sin(PI - inner_ang - PI/6)
  */

  var r = d * Math.sin(Math.PI / 6);
  r /= Math.sin(Math.PI - inner_ang - Math.PI/6);

  if (in_inner) {
    tx = 0;
    ty = 0;
  }
  else {
    // Get end point on the triangle
    tx = -(r*diff) * Math.sin(ang);
    ty = -(r*diff) * Math.cos(ang);
  }

  tx += x;
  ty += y;

  return {x: tx, y: ty};
}

window.onload = function() {
  var gender = {};
  var sexuality = {};

  var attr = {};
  attr.outer = {fill: "#ccf", stroke: "#225", "stroke-width": "1.35"};

  gender.paper = Raphael("genderTriField", 200, 200);
  gender.selector = drawSelector(gender.paper,
                                 100, 100, 100,
                                 attr.outer,
                                 "I Identity As",
                                 { middle: "none", top: "all",
                                   left: "male", right: "female"},
                                 parseInt(document.getElementById("genderXPos").value),
                                 parseInt(document.getElementById("genderYPos").value));

  sexuality.paper = Raphael("sexualityTriField", 200, 200);
  sexuality.selector = drawSelector(sexuality.paper,
                                    100, 100, 100,
                                    attr.outer,
                                    "I'm Attracted To",
                                    { middle: "none", top: "all",
                                      left: "male", right: "female"},
                                    parseInt(document.getElementById("sexualityXPos").value),
                                    parseInt(document.getElementById("sexualityYPos").value),
                                    false);

  var output = {};
  output.paper = Raphael("output", 500, 250);
  output.gen_ring  = output.paper.prettyReuleauxRing(125, 125, 98, 17,
      "I Identify As",
      { middle: "\u26aa", top: "\u26a7",
        left: "\u2642", right: "\u2640"});

  output.sex_ring  = output.paper.prettyReuleauxRing(375, 125, 98, 17,
      "I'm Attracted To",
      { middle: "\u26aa", top: "\u26a7",
        left: "\u2642", right: "\u2640"}, true);

  output.gen_ring.set_knob(0, 0);
  gender.selector.updated = function(x,y) {
    output.gen_ring.set_knob(x, y);
  }

  sexuality.selector.updated = function(knobs) {
    if (output.area != undefined) {
      output.area.remove();
    }

    var areapath = getAreaPoints(output.sex_ring.center.x, output.sex_ring.center.y, 98, 17, knobs, output.paper);
    output.area = output.paper.pathFromBuilder(areapath).attr({fill: "#fff", "fill-opacity": 0.5, stroke: "#c359a4"});
  }

  gender.selector.updated = function(x,y) {
    sexuality.selector.updated(sexuality.selector.knobs);
  }
}
