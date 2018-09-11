const express = require('express')
const mongo = require('./mongo')
const multiparty = require('connect-multiparty')
const fs = require('fs')
const moment = require('moment')
const md5 = require('blueimp-md5')

moment.locale('zh-cn')

var mutipartMiddeware = multiparty();
var router = express.Router()
/* 暴露函数，通过函数的参数传递IO对象 */
function admin(io) {
  router
    .get('/', (req, res) => {
      /* 判断登录状态  */
      var userinfo = req.session.user
      console.log(req.session.user)
      /* 进入聊天服务器 */
      io.on('connection',(socket) => {
        console.log('user access:' + socket.id)
        socket.on('user',(userObj) => {
          /* 添加上线用户 */
          io.emit('useradd',userObj)
        })
      })
      io.on('disconnect',() => {

        console.log('user leave:' + socket.id)
      })
      mongo.Post.find((err, postdata) => {
        if (err) return res.status(500)
        /* 对象属性抽离，解决template陷入递归 */
        /* mogon取出的对象不正常，转换一下 */
        var data = JSON.stringify(postdata)
        data = JSON.parse(data)
        var images = []
        data.forEach((element,a) => {
          images.push(element.images)
          delete element.images
        });
        res.render('index.html', {
          post: data,
          userinfo: userinfo,
          images: images
        })
      })
    })
    .post('/sendpost', mutipartMiddeware, (req, res) => {
      /* 临时图片迁移 */
      console.log(req.body)
      postObj = new mongo.Post({
        title: req.body.title,
        content: req.body.content,
        postuser: req.body.postuser,
      })
      if (req.files.pic.length > 1) {
        var c = req.files.pic.length
        req.files.pic.forEach(item => {
          var target_path = './upload/post/' + item.name
          fs.rename('./' + item.path, target_path, function (err) {
            if (err) res.status(500)
            postObj.images.push(target_path.replace('.',''))
            c--;
            if (c === 0 ){
              postObj.save((err, result) => {
              if (err) res.status(500)
                res.json({
                  success: true,
                  message: '发帖成功'
                });
              })
            }
            // 删除临时文件夹文件, 
            fs.unlink('./' + item.path, function () {
              if (err) res.status(500)
            });
          });
        });
      }else {
        var target_path = './upload/post/' + req.files.pic.name
        fs.rename('./' + req.files.pic.path, target_path, function (err) {
          if (err) res.status(500)
          postObj.images.push(target_path.replace('.',''))
          // 删除临时文件夹文件, 
          fs.unlink('./' + req.files.pic.path, function () {
            if (err) res.status(500)
          });
          postObj.save((err, result) => {
          if (err) res.status(500)
            res.json({
              success: true,
              message: '发帖成功'
            });
          })
        });
      }
    })
    .get('/login',(req,res) => {
      res.render('login.html')
    })
    .post('/login',(req,res) => {
      console.log(req.body)
      mongo.User.findOne({
        username: req.body.username
      },(err,result) => {
        if(result == null){
          res.status(200).json({
            code: 1,
            message: '用户不存在'
          })
        }else if (result.status[0]) {
          res.status(200).json({
            code: 3,
            message: '该用户被封禁'
          })
        }else if (result.password === md5(md5(req.body.password))){
          // res.status(200).json({
          //   code: 0,
          //   message: '登录成功'
          // })
          /* 记录session状态 */
          req.session.user = result
          // console.log(req.session.user)
          res.redirect('/')
        }else {
          res.status(200).json({
            code: 2,
            message: '密码错误'
          })
        }
      })
    })
    .get('/register',(req,res) => {
      res.render('register.html')
    })
    .post('/register',(req,res) => {
      console.log(req.body)
      mongo.User.findOne({
        username: req.body.username
      },(err,result) => {
        console.log(result)
        if(result){
          res.status(200).json({
            code: 1,
            message: '用户名重复'
          })
        }else if (true) {
          new mongo.User({
            username: req.body.username,
            password: md5(md5(req.body.password)),
            nickname: req.body.nickname
          }).save((err,doc) =>{
            if (err) res.status(500).send(err)
            // res.status(200).json({
            //   code: 0,
            //   message: '注册成功'
            // })
            res.redirect('/')
            /* 记录session状态 */
            req.session.user = doc
          })
        }else {
          res.status(200).json({
            code: 2,
            message: '禁止新用户注册'
          })
        }
      })
    })
  return router
}
module.exports = admin