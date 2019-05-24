var rgxNotAllowed = /[^a-zA-Z0-9!#\s\+\-\*\/\^\.\(\)\:\,=<>"']/g;
var elements = {};
var _repairedExpression;
var _currentTarget;
var _currentOriginator;

function addElements(selectors) {
  console.log("addElements", arguments);

  var toAdd = [];
  for (var i = 0; i < arguments.length; i++) {
    var selector = arguments[i];
    $(selector).each(function () {

      var element = $(this).context;

      //addElement($(this));

      if (element.id == "") {
        alert("No ID specified for element");
      }
      else {

        var co = elements[element.id];

        if (!co) {
          var co = {
            exp: undefined,
            val: element.value,
            //val: setExpression(element.id, element.value),
            //valueProp: valueProp,
            id: element.id,
            operands: [],
            dependants: []
          };

          elements[element.id] = co;
        }



        element.onchange = function (e) {

          console.log('change', element.value);
          elements[element.id].exp = element.value;
          setExpression(element.id, elements[element.id].exp);
          element.open = false;

        };

        element.onclick = function (e) {
          if (elements[element.id].exp && !element.open) {
            console.log("element.onclick", e, elements[element.id]);
            element.value = elements[element.id].exp;
            element.open = true;
          }

        };

        element.onblur = function (e) {
          if (elements[element.id].val) {
            element.value = elements[element.id].val;
            element.open = false;
          }

        };
      }

    });
  }

}

function addElement() {

}



function removeElements(selectors) {
  $("#t1").context.onchange = function () { };
  console.log("removing", $("#t1"));
}

function calc() {
  $("#out").html(Number($("#t1").val()) + Number($("#t2").val() + Number($("#t3").val())));
}

//----------------------------------
//  solve
//----------------------------------
/**
 * Solves the mathemathical expression and supports formulas like SUM(2,3), MAX(a1:d3), etc.
 *
 * @param exp Expression that needs to be solved
 * @param forget Internal, you never need to set this param
 * @return A string that is numeric solution to the expression
 *
 * */
function solve(expression, forget) {
  var exp = expression;
  var error = "ok";// checkValidExpression(expression);
  console.log("solve", error);

  if (error == "ok") {
    var res;

    // remove white spaces from expression		
    exp = exp.replace(/\s+/g, "");

    // add outer brackets to the expression to enable iterative paren solving
    exp = "(" + exp + ")";

    // convert negative values from - to ~. E.g. 5+-3, into 5+~3
    // var rxNeg:RegsExp = /([\(\+\-\*\/])\-/g;
    var rxNeg = /([\(\+\-\*\/])\-([A-Za-z0-9\(])/g;

    exp = exp.replace(rxNeg, "$1~$2");

    exp = repairOperators(exp);

    // remember the expression before it gets modified into result
    if (!forget)
      _repairedExpression = repairExpression(exp);

    // find the innermost brackets, also see if brackets are part of formula - SUM(args)
    var rxParen = /([A-Za-z]*)\([^()]*\)/g;

    // repeat while all the brackets are gone, method called to replace brackets with a value is solveParen
    while (exp.indexOf("(") != -1) {
      exp = exp.replace(rxParen, solveBracket);
    }

    // replace ! back to -, for casting to number, negative if you will
    exp = exp.replace("~", "-");

    res = Number(exp);
  }
  else {
    exp = error;

    // var errEvt : SpreadsheetEvent = new SpreadsheetEvent(SpreadsheetEvent.ERROR);
    // errEvt.message = isValid;
    // this.dispatchEvent(errEvt);
  }


  if (isString(exp))
    exp = stripStringQuotes(exp);

  console.log("solved", exp);

  return exp;

}


//----------------------------------
//  solveParen
//----------------------------------
/**
 * @private 
 * Solves an individual expression contained within parenthesis. 
 * Used internaly by solveExpression().
 * 
 * @param: arguments is automatically passed from String.replace() function in solveExpression() method.
 * @return A string that is numeric solution to the expression in parenthesis
 *
 * */

function solveBracket() {
  var args = arguments;

  var exp = arguments[0];

  var ops = /[\/\*\+\-\^~]+/g;
  var a = exp.match(ops) || [];

  if (exp.substr(0, 1) != "(") {
    //exp = solveFormula(exp);
  }
  else if (a.length == 0) {
    exp = exp.replace(/[\(\)]/g, "");

    if (!isString(exp))
      exp = getValueFromOperand(exp).toString();
  }
  else {
    // remove enclosing brackets from string
    exp = exp.replace(/[\(\)]/g, "");

    // find a simple expression with operator, one operand on the left, and one operand on the right
    // this RegExp takes care of ^ operator
    // example: 4+5*4^3, results in finding first 4^3, then 5*4 in the second while iteration
    var regex = /([a-zA-Z0-9~!\.]+)(\^)([a-zA-Z0-9~!\.]+)/g;

    // do while there are no more operators.
    // function called to replace this expression with a numeric string is solveSimple
    while (exp.indexOf("^") != -1) {
      exp = exp.replace(regex, solveSimple);
    }


    // find a simple expression with operator, one operand on the left, and one operand on the right
    // this RegExp takes care of * and / operators
    // example: 4+5*4*3, results in finding first 5*4, then 20*3 in the second while iteration
    regex = /([a-zA-Z0-9~!\.]+)([\*\/])([a-zA-Z0-9~!\.]+)/g;

    // do while there are no more operators.
    // function called to replace this expression with a numeric string is solveSimple
    while (exp.indexOf("*") != -1 || exp.indexOf("/") != -1) {
      exp = exp.replace(regex, solveSimple);
    }

    // find a simple expression with operator, one operand on the left, and one operand on the right
    // this RegExp takes care of + and - operators
    // example: 1+2-4, results in finding first 1+2, then 3-4, in the second while iteration  
    regex = /([a-zA-Z0-9~!\.]+)([\+-])([a-zA-Z0-9~!\.]+)/g;

    // do while there are no more operators.
    // function called to replace this expression with a numeric string is solveSimple
    while (exp.indexOf("+") != -1 || exp.indexOf("-") != -1) {
      exp = exp.replace(regex, solveSimple);
    }
  }

  return exp;
}



//----------------------------------
//  solveSimple
//----------------------------------
/**
 * @private
 * Solves simple expressions with one operator, one operand on the left, and one operand on the right.
 * @return A numerical string that is a solution to passed expression.
 * @param: arguments is automatically passed from String.replace() function in solveParen() method.
 * */
function solveSimple() {
  var op = arguments[2];

  var sLeft = arguments[1];
  sLeft = sLeft.replace("~", "-");
  var left = getValueFromOperand(sLeft);

  var sRight = arguments[3];
  sRight = sRight.replace("~", "-");
  var right = getValueFromOperand(sRight);

  var res;

  switch (op) {
    case "+":
      res = left + right;
      break;

    case "-":
      res = left - right;
      break;

    case "*":
      res = left * right;
      break;

    case "/":
      res = left / right;
      break;

    case "^":
      res = Math.pow(left, right);
      break;
  }

  var sRes = res.toString();

  // convert negative values from - to !. E.g. -2, into !2
  sRes = sRes.replace("-", "~");

  return sRes;
}



//----------------------------------
//  getValueFromOperand
//----------------------------------
/**
 * This method extracts the value from a Control specified as String.
 * Calc uses this when solving expressions, if the expression is '=A1 + 5', it will attempt to find a ControlObject with the id="a1", and return its value.
 * 
 * @param operand String identifying the control (for example operand in the expression)
 * @param emptyStringPolicy Can be "zero" or "nan", specifies what the function will return if the operand is not found. 
 * @return A Number that is the value of the control specified. If not found and emptyStringPolicy=="nan", return value is NaN. If not found and emptyStringPolicy=="zero", return value is 0. 
 *
 * */
function getValueFromOperand(operand)//, emptyStringPolicy = "zero")
{
  var rn;
  var m = 1;

  if (operand.substr(0, 1) == "-") {
    m = -1;
    operand = operand.substr(1);
  }

  if (isNaN(Number(operand))) {
    var co = elements[operand];

    if (co) {
      //rn = Number(solve(co.exp, false));
      rn = Number(co.val);
      //rn = $("#"+operand).val();

      if (_currentTarget) {
        if (_currentTarget.operands.indexOf(co) == -1) {
          _currentTarget.operands.push(co);
          //currentTarget.children.push(co);
        }
      }
    }
    else {
      rn = 0;
    }

    // if (co != null)
    // {
    // 	if (co.ctrl[co.valueProp] == "" && emptyStringPolicy == "nan")
    // 	{
    // 		rn = NaN;
    // 	}
    // 	else
    // 	{
    // 		rn = Number(co.ctrl[co.valueProp]);
    // 	}


    // else
    // {
    // 	rn = 0;
    // 	var erev : SpreadsheetEvent = new SpreadsheetEvent(SpreadsheetEvent.WARNING);
    // 	erev.message = "Operand does not exist: " + operand + ". Calculations might not appear as expected.";
    // 	this.dispatchEvent(erev);

    // }
  }
  else {
    rn = Number(operand);
  }

  rn *= m;

  return rn;
}



function setExpression(targetId, expression, update) {

  var _val;
  var co = elements[targetId];
  var element = $("#" + targetId);

  console.log("setExpression", co, targetId);

  if (!co) {
    alert("Element not yet added to calc: " + targetId);
  }


  // remove this object as dependant from all of the operands
  if (!update) {
    _currentOriginator = co;

    for (var o in co.operands) {
      var op = co.operands[o];
      var ind = op.dependants.indexOf(co);

      if (ind >= 0) {
        op.dependants.splice(ind, 1);
      }
    }

    co.operands = [];
    //co.children = new Array();
  }




  _currentTarget = co;

  if (expression.substr(0, 1) == "=") {
    _val = solve(expression.substr(1), false).toString();
    co.exp = "=" + _repairedExpression;
    _repairedExpression = undefined;
  }
  else {
    _val = expression;
    co.exp = undefined;
  }


  // add this object as dependant to each operand
  if (!update) {
    for (op in co.operands) {
      co.operands[op].dependants.push(co);
    }
  }

  co.val = _val;
  console.log('set expression', co, _val);
  $("#" + co.id).val(_val);

  //console.log("elms", elements);


  updateDependent(co);


  currentTarget = null;


}

//----------------------------------
//  updateDependent
//----------------------------------
/**
 * @private
 * Loops recursively through the dependent objects of objectChanged until all dependants are resolved.
 * */
function updateDependent(objectChanged) {

  if (objectChanged.dependants.length > 0) {
    console.log('updateDependent');
    for (var co in objectChanged.dependants) {
      var c = objectChanged.dependants[co];

      if (c != _currentOriginator) {
        if (c.exp && c.exp != "")
          setExpression(c.id, c.exp, true);
      }
      else {
        alert("Cyclic reference detected at: " + _currentOriginator.id + "<->" + objectChanged.id + ". Reset this field.");


        _currentOriginator.exp = "";
      }
    }
  }

}





















//----------------------------------
//  repairExpression
//----------------------------------
/**
 * Replaces ~ by - and removes outer brackets. Eg: "(5 * ~3)", to "5 * -3".
 * @param exp String represating the expression that needs to be repaired
 * @return String repaired expression.
 * */
function repairExpression(exp) {
  exp = exp.replace(/~/g, "-");

  exp = exp.replace("(", "");
  exp = exp.substr(0, exp.lastIndexOf(")"));

  return exp;
}

//----------------------------------
//  repairOperators
//----------------------------------
/**
 * This function attempts to repair the misstyped and redundant operators,
 * by returning only the first valid operator.
 * e.g.: -+5+*!+/3+, result: -5+3.
 * Secondly, it attempts to repair redundant operators in parenthesis,
 * e.g.: (*5+6/), result: (5+6).
 * @param exp String of expression to attempt to repair.
 * @return String repaired expression.
 * */
function repairOperators(exp) {

  var rx = /([\^\*\+\/\-]{2,})/g;

  exp = exp.replace(rx, useFirstOp);

  rx = /(\()([\^\*\+\/\-!]+)([A-Za-z0-9~])/g;

  exp = exp.replace(rx, "$1$3");

  //maybeTODO: temporarily removed * and !
  rx = /([A-Za-z0-9~])([\^\+\/\-!]+)(\))/g;

  exp = exp.replace(rx, "$1$3");

  return exp;
}

//----------------------------------
//  useFirstOp
//----------------------------------
/**
 * Regex replacement function that returns first operator if multiple are given in the expression. Used by repairOperators()
 * @args Passed in by RegExp.replace.
 * */
function useFirstOp() {
  var ops = args[0];
  ops = ops.replace(/!/g, "");

  ops = ops.substr(0, 1);

  return ops;
}


//----------------------------------
//  checkValidExpression
//----------------------------------
/**
 * Checks if the string is a valid expression to be accepted by Calc or Spreadsheet and returns an error String.
 * @param exp String that you want to check if it is a valid expression.
 * @return String 'ok' if exp is valid expression, error string if not.
 * */
function checkValidExpression(exp) {
  var err = "ok";

  var rt = /r/g;

  var na = exp.match(rgxNotAllowed) || [];

  console.log(na);

  if (na.length > 0) {
    err = "!Error: Illegal characters detected:";

    for (var s in na) {
      err += " " + na[s];
    }
  }

  var leftPars = exp.match(/\(/g) || [];
  var rightPars = exp.match(/\)/g) || [];

  if (leftPars.length != rightPars.length) {
    err = "!Error: Opening and closing brackets do not match.";
  }

  //TODO: Only allow = in the beginning and in IF
  if (exp.indexOf("=") != -1) {
    //err = "!Error: '=' can only be used once in the beginning to indicate expression.";
  }

  return err;
}


//----------------------------------
//  stripStringQuotes
//----------------------------------
/**
 * Removes quotes from beginning and end of the input String.
 * @param input String to remove the quotes from.
 * @return String with removed quotes characters from the beginning and end of input String. 
 * */
function stripStringQuotes(input) {
  var rs;
  var len = input.length;

  if ((input.substr(0, 1) == "'" && input.substr(len - 1, 1) == "'")
    || (input.substr(0, 1) == "\"" && input.substr(len - 1, 1) == "\"")) {
    rs = input.substring(1, len - 1);
  }

  return rs;
}


//----------------------------------
//  isString
//----------------------------------
/**
 * Recognizes if supplied <i>input</i> is supposed to be treated as string within calculation expressions. 
 * That means it checks wheather it is enclosed in double quotes.
 * This is not to be confused with ActionScript String class, it is a separate construct that is used in Calc.
 * <br/><br/>
 * <b>Example:</b><br/> isString("s"), returns <i>false</i><br/> isString(""s""), returns <i>true</i>
 * @param input String that needs to be checked if it is a valid string representation for Calc.
 * @return Boolean true if the specified string is a valid string representation for Calc.
 * */
function isString(input) {
  var b = false;
  var len = input.length;

  if (input.substr(0, 1) == "\"" && input.substr(len - 1, 1) == "\"") {
    b = true;
  }

  if (input.substr(0, 1) == "'" && input.substr(len - 1, 1) == "'") {
    b = true;
  }

  return b;
}




(function (undefined) {
  console.log("fancy");

  //var calc;

  var i;

  function makeCalc(config) {
    console.log("make calc");
  };

  calc = function (config) {
    i = config.i;
    //console.log("fancy calc");

    return calc;
  };
  calc.sayI = function () {
    console.log(i);
  }




}).call(this);

