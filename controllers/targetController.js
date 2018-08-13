var db = require("../db/config");
var logger = require("../utils/logger");

var async = require("async");
var moment = require("moment");
var momentTz = require('moment-timezone');
var _ = require("lodash");

exports.getTargetByBranchId = function(req,res,next) {

    targetByBranchId({id : req.params.id, date : req.query.date}, function(err, result){
        if(err) {
            return res.json(err);
        }
        res.json(result);
    });
}

exports.targetByBranchId = targetByBranchId;

function targetByBranchId(obj, cb) {
    
    var sql = "\
    SELECT bp.bp_id as branch_product_id,\
    pt.quantity as target,\
    pt.effective_start_date as start_date, \
    pt.effective_end_date as end_date\
    FROM `branch-product` bp,\
        `product-target` pt\
    WHERE bp.bp_id = pt.branch_product_id\
       and bp.branch_id = ?\
       and pt.effective_end_date > ? \
   ";
   
    console.log(obj.id,obj.date);
    try {
       db.query(sql,[obj.id, obj.date], function(err, result) {
          if (err) {
            logger.error(err);
            cb(err);
          }
          logger.info("Inventory Data found for branch-product id "+ obj.id);
         cb(null, result);
        });
    } catch (err) {
        logger.error(err);
        cb(err);
    }
}

    
exports.getTargetCountByBranchId = getTargetCountByBranchId;

function getTargetCountByBranchId(obj, cb) {
    
    var sql = "\
    SELECT bp.bp_id as branch_product_id,\
    pt.quantity as target,\
    pt.effective_start_date as start_date, \
    pt.effective_end_date as end_date\
    FROM `branch-product` bp,\
        `product-target` pt\
    WHERE bp.bp_id = pt.branch_product_id\
        and bp.branch_id = ?\
        and pt.effective_end_date >= ? and pt.effective_start_date <= ? \
    ";
    
    console.log(obj.id,obj.startDate, obj.endDate);
    try {
        db.query(sql,[obj.id, obj.endDate, obj.startDate], function(err, result) {
            if (err) {
            logger.error(err);
            cb(err);
            }
            logger.info("Inventory Data found for branch-product id "+ obj.id);
            cb(null, result);
        });
    } catch (err) {
        logger.error(err);
        cb(err);
    }
}


exports.getProducts = function(req,res,next) {
    var sql = "SELECT * FROM maithree.product";
  
    try {
       db.query(sql,[req.params.id, req.query.date], function(err, result) {
          if (err) {
            logger.error(err);
            return next(err);
          }
          logger.info("List of all Products");
          res.json(result);
        });
    } catch (err) {
        logger.error(err);
        next(err);
    }
    
} 


exports.getBranchProductDetailsForTarget = function(req, res, next){
  var date = req.query.date;
  async.waterfall([
    function getFromBranchProduct(callback) {
        var sql = "select a.id, b.branch_id, b.bp_id, 'target' as TempField from `product` a, `branch-product` b where a.id = b.product_id order by a.id;"  
          executeQuery(sql, function(data) {
              console.log(' result from branch product query ' ,data);
              callback(null, data);
          });
    },
    function getTarget(resultData, callback) {
        var sql = "select branch_product_id , quantity as targetVal from `product-target` where effective_start_date <= ? and effective_end_date >= ?"  
        db.query(sql,[date, date], function(err, result) {
            if (err) {
                logger.error(err);
            }
           const r = groupBy(result, (c) => c.branch_product_id);
           const op = resultData.map((rs,i)=>{
               return {...rs, targetVal : r[rs.bp_id][0].targetVal }
            })
            callback(null, op);
        });
    },
    function groupByBranchId(targetData, callback) {
        const result = groupBy(targetData, (c) => c.id);
        console.log(result);
        callback(null, result);
    },
    function getBranchesAndFormTemplate(groupedBranches, callback) {
        // branches order 1001,1002- form template {}
        var sql = "SELECT * from `branch` ";
        db.query(sql, function(err, result) {
            if (err) {
                logger.error(err);
            }
            logger.info("Number of branchces " + result.length);
            console.log(result);
            
            var template = {};
            console.log("result ", result);
            result.map((rs,i)=> {
                template[rs.id.toString()]= {
                    "id":'',
                    "branch_id":rs.id,
                    "bp_id": '',
                    "TempField": false,
                    "targetVal":0
                };
            });
            console.log(template);
            callback(null , {groupedBranches , template})
            
        });
    },
    function (prevdata, callback) {
        var bdata = prevdata.groupedBranches;
        var template = prevdata.template;
      
        var sql = "SELECT * FROM product";
        executeQuery(sql, function(data) {
            let productData = data
            for(let i in productData) {
                var temp = {... template};
                let pId = productData[i].id.toString();
                let productUsedInBranches = bdata[pId];
                if(productUsedInBranches == undefined) {
                    productData[i]['targetData'] = temp;
                   
                } else {
                    for(var j=0; j<productUsedInBranches.length ; j++) {
                        var id = productUsedInBranches[j].branch_id.toString();
                        if(temp[id]){
                            temp[id] = productUsedInBranches[j];
                            temp[id].TempField = true;
                        }
                    }
                        productData[i]['targetData'] = temp;
                }
                
            }
            callback(null, productData);
        })
    }
], function (err, result) {
     res.json(result);
});
}


function executeQuery(sqlQuery, cb) {
  try {
      console.log(sqlQuery)
       db.query(sqlQuery, function(err, result) {
          if (err) {
            logger.error(err);
            cb(err);
          }
          logger.info("Finding results");
         cb(result);
        });
    } catch (err) {
       cb(err);
    }
}

function groupBy(xs, f) {
  return xs.reduce((r, v, i, a, k = f(v)) => ((r[k] || (r[k] = [])).push(v), r), {});
}