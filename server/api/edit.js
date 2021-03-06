let app = require('../app.js')
const dbHandel = require('../db/handel.js')
const fs = require('fs')
let path = require('path')
let glob = require('glob')
let QRCode = require('qrcode')
let md5 = require('md5')
const rimraf = require('rimraf')
const sha1 = require('sha1')
const uuid = require('uuid/v1');
const utils = require('../utils')
const {
    AccessKey,
    SecretKey
} = require('../../.key.js')
const {
    promisify
} = require('util')
const qiniu = require('qiniu')
const {
    upload
} = require('../qiniu/upload')

const {
    DEFAULT_PAGE,
    AJ_STATUS,
    AJ_MESSAGE
} = require('../const/index')


/**
 * 列表页， 获取
 */
app.get('/aj/scene/get', async (req, res) => {
    const collection = dbHandel.getModel('myh5')
    const id = Number(req.query.id)
    const errorMessage = '场景不存在'
    if (isNaN(id)) {
        res.send({
            status: AJ_STATUS.error,
            message: errorMessage
        })
    } else {
        const data = await collection.findOne({
            id: id
        })
        if (data) {
            data.portrait = data.domain + data.portrait
            res.send({
                status: AJ_STATUS.success,
                message: AJ_MESSAGE.success,
                result: {
                    data: data
                }
            })
        } else {
            res.send({
                status: AJ_STATUS.error,
                message: errorMessage
            })
        }
    }



})

/**
 * 列表页， 获取发布后的数据
 */
app.get('/aj/scene/getPublishData', async (req, res) => {
    const collection = dbHandel.getModel('myh5')
    const data = await collection.findOne({
        id: req.query.id
    })
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: {
            data: data
        }
    })
})

/**
 * 列表页， 保存
 */
app.post('/aj/scene/save', async (req, res) => {
    const collection = dbHandel.getModel('myh5')
    let data = await collection.findOne({
        id: req.body.id
    })
    //如果还是未发布状态， 修改数据，发布状态还是0 ， 如果是已发布状态， 就改成已修改
    await collection.update({
        id: req.body.id
    }, {
        data: req.body.data,
        updateTime: utils.getTime(),
        status: data.status != 0 ? 2 : 0
    })

    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: {}
    })
})


/**
 * 获取形状的导航信息
 */
app.get('/aj/shape/nav', async (req, res) => {
    const collection = dbHandel.getModel('desc')
    let {
        shape
    } = await collection.findOne();
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: shape
    })
})


/**
 * 获取形状
 * @param {page}
 * @param {limit}
 * @param {typeId}
 * @param {tagId}
 */
app.get('/aj/shape/get', async (req, res) => {
    const collection = dbHandel.getModel('shape')
    const usedCollection = dbHandel.getModel('used_shapes')
    const page = Number(req.query.page) || DEFAULT_PAGE.page
    const limit = Number(req.query.limit) || DEFAULT_PAGE.limit
    let find = {}
    req.query.typeId && (find.typeId = new RegExp(req.query.typeId))
    req.query.tagId && (find.tagId = new RegExp(req.query.tagId))
    let total, data;
    if (req.query.used) {
        let total = await usedCollection.count({
            uid: req.session.uid
        })
        let ddd = await usedCollection.find({
                uid: req.session.uid
            })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({
                usedTime: -1
            })
        ddd = ddd.map((item) => {
            return {
                id: item.shapeId
            }
        })
        var arrx = [];
        for (let i = 0; i < ddd.length; i++) {
            arrx.push(await collection.findOne(ddd[i], {
                content: 0
            }))
        }
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: arrx
            }
        })
    } else {
        total = await collection.count(find)
        data = await collection.find(find, {
                content: 0
            })
            .skip((page - 1) * limit)
            .limit(limit)
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: data
            }
        })
    }

})




/**
 * 获取某个svg的content? js是否可以根据svg url拿到content?
 */
app.get('/aj/shape/getContent', async (req, res) => {
    const collection = dbHandel.getModel('shape')
    const data = await collection.findOne({
        id: req.query.id
    })
    /* 添加到最近使用 */
    const usedCollection = dbHandel.getModel('used_shapes')
    let docs = await usedCollection.findOne({
        uid: req.session.uid,
        shapeId: Number(req.query.id)
    });
    if (docs) {
        await usedCollection.update({
            uid: req.session.uid,
            shapeId: Number(req.query.id),
        }, {
            usedTime: utils.getTime()
        })
    } else {
        await new usedCollection({
            uid: req.session.uid,
            shapeId: Number(req.query.id),
            usedTime: utils.getTime()
        }).save();
    }

    /* end 添加到最近使用 */
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: data.content
    })
})




/**
 * 获取音乐的导航信息
 */
app.get('/aj/music/nav', async (req, res) => {
    const collection = dbHandel.getModel('desc')
    let {
        music = []
    } = await collection.findOne();
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: music
    })
})
/**
 * 获取音乐的接口
 */
app.get('/aj/music/get', async (req, res) => {
    const collection = dbHandel.getModel('musics')
    const usedCollection = dbHandel.getModel('used_musics')
    const page = Number(req.query.page) || DEFAULT_PAGE.page
    const limit = Number(req.query.limit) || DEFAULT_PAGE.limit
    let find = {}
    req.query.typeId && (find.typeId = new RegExp(req.query.typeId))
    let data, total;
    if (req.query.used) {
        total = await usedCollection.count({
            uid: req.session.uid
        })
        let ddd = await usedCollection.find({
                uid: req.session.uid
            })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({
                usedTime: -1
            })
        ddd = ddd.map((item) => {
            return {
                id: item.musicId
            }
        })
        var arrx = [];
        for (let i = 0; i < ddd.length; i++) {
            arrx.push(await collection.findOne(ddd[i]))
        }
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: arrx
            }
        })
    } else if (req.query.isMy) {
        total = await collection.count({
            uid: req.session.uid
        })
        data = await collection.find({
                uid: req.session.uid
            })
            .skip((page - 1) * limit)
            .sort({
                createTime: -1
            })
            .limit(limit)
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: data
            }
        })
    } else {
        total = await collection.count(find)
        data = await collection.find(find)
            .skip((page - 1) * limit)
            .limit(limit)
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: data
            }
        })
    }


})


/**
 * 获取音乐的接口
 */
app.get('/aj/music/choice', async (req, res) => {
    if (!req.query.id) {
        res.send({
            status: AJ_STATUS.success,
            message: '音乐id不存在',
            result: {}
        })
        return;
    }
    const usedCollection = dbHandel.getModel('used_musics')
    let docs = await usedCollection.findOne({
        uid: req.session.uid,
        musicId: Number(req.query.id)
    });
    if (docs) {
        await usedCollection.update({
            uid: req.session.uid,
            musicId: Number(req.query.id),
        }, {
            usedTime: utils.getTime()
        })
    } else {
        await new usedCollection({
            uid: req.session.uid,
            musicId: Number(req.query.id),
            usedTime: utils.getTime()
        }).save();
    }
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: {}
    })
})






/**
 * 获取音乐的导航信息
 */
app.get('/aj/image/nav', async (req, res) => {
    const collection = dbHandel.getModel('desc')
    let {
        image = []
    } = await collection.findOne();
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: image
    })
})


/**
 * 获取图片的接口
 */
app.get('/aj/image/get', async (req, res) => {
    const collection = dbHandel.getModel('images')
    const usedCollection = dbHandel.getModel('used_images')
    const page = Number(req.query.page) || DEFAULT_PAGE.page
    const limit = Number(req.query.limit) || DEFAULT_PAGE.limit
    let find = {}
    req.query.typeId && (find.typeId = new RegExp(req.query.typeId))
    let data, total;
    if (req.query.used) {
        total = await usedCollection.count({
            uid: req.session.uid
        })
        let ddd = await usedCollection.find({
                uid: req.session.uid
            })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({
                usedTime: -1
            })
        ddd = ddd.map((item) => {
            return {
                id: item.imageId
            }
        })
        var arrx = [];
        for (let i = 0; i < ddd.length; i++) {
            arrx.push(await collection.findOne(ddd[i]))
        }
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: arrx
            }
        })
    } else if (req.query.isMy) {
        total = await collection.count({
            uid: req.session.uid
        })
        data = await collection.find({
                uid: req.session.uid
            })
            .skip((page - 1) * limit)
            .sort({
                createTime: -1
            })
            .limit(limit)
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: data
            }
        })
    } else {
        total = await collection.count(find)
        data = await collection.find(find)
            .skip((page - 1) * limit)
            .sort({
                createTime: -1
            })
            .limit(limit)
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            result: {
                info: {
                    page: Number(req.query.page || DEFAULT_PAGE.page),
                    total: total,
                    limit: Number(req.query.limit || DEFAULT_PAGE.limit),
                },
                data: data
            }
        })
    }


})


/**
 * 获取音乐的接口
 */
app.get('/aj/image/choice', async (req, res) => {
    if (!req.query.id) {
        res.send({
            status: AJ_STATUS.success,
            message: 'imageId不存在',
            result: {}
        })
        return;
    }
    const usedCollection = dbHandel.getModel('used_images')
    let docs = await usedCollection.findOne({
        uid: req.session.uid,
        imageId: Number(req.query.id)
    });
    if (docs) {
        await usedCollection.update({
            uid: req.session.uid,
            imageId: Number(req.query.id),
        }, {
            usedTime: utils.getTime()
        })
    } else {
        await new usedCollection({
            uid: req.session.uid,
            imageId: Number(req.query.id),
            usedTime: utils.getTime()
        }).save();
    }
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: {}
    })
})


/**
 * 二维码
 */
app.get('/aj/qrcode/create', async (req, res) => {
    let {
        url,
        margin = 4
    } = req.query

    if (!url) {
        res.send({
            status: AJ_STATUS.error,
            message: AJ_MESSAGE.error,
            result: `url不存在`
        })
        return
    }
    url = decodeURIComponent(url)
    let fileName = `${md5(`url=${url};time:${utils.getTime()};margin:${margin}`)}.svg`
    toFileSync = promisify(QRCode.toFile);
    let toFilePath = path.resolve(process.cwd(), 'cache', fileName);
    await toFileSync(toFilePath, url, {
        type: 'svg',
        margin: Number(margin)
    });
    await upload('store', toFilePath, fileName);
    rimraf.sync(toFilePath)
    res.send({
        status: AJ_STATUS.success,
        message: AJ_MESSAGE.success,
        result: `http://p7d4z759a.bkt.clouddn.com/${fileName}`
    })
});

/**
 * 
 */

// app.get('/aj/shape/gggg', async (req, res) => {
//   const collection = dbHandel.getModel('desc')
//   const shapeCollection = dbHandel.getModel('shape')
//   let {
//     shape
//   } = await collection.findOne();

//   for (let i = 0; i < shape.type.length; i++) {
//     // let docs = glob.sync(`/Users/BraisedCakes/Desktop/2018/myh5-store/svg-json/${shape.type[i].name}/*.json`);
//     // console.log(docs);
//     // for (let j = 0; j < docs.length; j++) {
//     //   let json = JSON.parse(fs.readFileSync(docs[j], 'utf-8'));
//     //   // console.log(json)

//     //   for(let z = 0; z < json.length; z++){
//     //     console.log(path.basename(json[z].path))
//     //   }
//     // }
//     let typeId = shape.type[i].typeId;
//     for (let j = 0; j < shape.type[i].children.length; j++) {
//       // console.log(j)
//       let child = shape.type[i].children[j];
//       let json = JSON.parse(fs.readFileSync(`/Users/BraisedCakes/Desktop/2018/myh5-store/svg-json/${shape.type[i].name}/${child.name}.json`, 'utf-8'));
//       // console.log(docs)
//       for (let z = 0; z < json.length; z++) {
//         let paths = path.basename(json[z].path);
//         await shapeCollection.update({
//           path: paths
//         }, {
//           typeId: typeId,
//           tagId: child.tagId
//         })
//       }
//     }

//   }
//   res.send({
//     data: shape
//   })
// })







/**
 * 列表页， 添加
 */
// app.get('/aj/shape/del', async (req, res) => {
//     const collection = dbHandel.getModel('shape')
//     await collection.remove({});
//     res.send({
//         status: AJ_STATUS.success,
//         message: AJ_MESSAGE.success,
//         result: '成功'
//     })
// });
// app.get('/aj/shape/add', async (req, res) => {
//     const collection = dbHandel.getModel('shape')
//     const count = await collection.count()
//     let docs = glob.sync('/Users/BraisedCakes/Desktop/2018/myh5-store/svg-json/*/*.json')
//     let index = 400000000
//     for (let i = 0; i < docs.length; i++) {
//         let file = JSON.parse(fs.readFileSync(docs[i], 'utf-8'));
//         for (let j = 0; j < file.length; j++) {
//             new collection({
//                 path: path.basename(file[j].path),
//                 id: index++
//             }).save((err, docs) => {

//             })
//         }
//     }
//     res.send({
//         status: AJ_STATUS.success,
//         message: AJ_MESSAGE.success,
//         result: {}
//     })
// })



/**
 * typeId 400 +
 * tagId  4000 + 
 */
// app.get('/aj/shape/nav/get', async (req, res) => {
//     const collection = dbHandel.getModel('shape')
//     let docs = glob.sync('/Users/BraisedCakes/Desktop/2018/myh5-store/svg-json/*/*.json')
//     // console.log(docs)
//     let typeId;
//     let tagId = 40000;
//     for (let i = 0; i < docs.length; i++) {
//         let file = JSON.parse(fs.readFileSync(docs[i], 'utf-8'));
//         switch (path.basename(path.dirname(docs[i]))) {
//             case '图形':
//                 typeId = 400;
//                 break;
//             case '图标':
//                 typeId = 401;
//                 break;
//             case '文字':
//                 typeId = 402;
//                 break;
//         }
//         tagId++;
//         for (let j = 0; j < file.length; j++) {
//             await collection.update({
//                 path: file[j].path
//             }, {
//                 typeId: typeId,
//                 tagId: tagId
//             })
//         }
//     }
//     let data = await collection.find();
//     console.log(data)


//     res.send({
//         status: AJ_STATUS.success,
//         message: AJ_MESSAGE.success,
//         result: 111
//     })
// })



// app.get('/aj/shape/nav/set', async (req, res) => {
//     const collection = dbHandel.getModel('desc')
//     let docs = glob.sync('/Users/BraisedCakes/Desktop/2018/myh5-store/svg-json/*')
//     let docs2 = glob.sync('/Users/BraisedCakes/Desktop/2018/myh5-store/svg-json/*/*.json')
//     const {
//         shape = {}
//     } = await collection.findOne({
//         id : 1
//     })
//     shape.typeId = shape.typeId || [];
//     let typeId;
//     if (shape.typeId.length > 0) {
//         typeId = shape.typeId[shape.typeId.length - 1].id + 1
//     } else {
//         typeId = 400
//     }
//     for (let i = 0; i < docs.length; i++) {
//         let btn = shape.typeId.some((item)=>{
//             return item.name == path.basename(docs[i])
//         })
//         if(btn){
//             continue;
//         }
//         shape.typeId.push({
//             id: typeId,
//             name: path.basename(docs[i])
//         })
//         typeId++;
//     }
//     await collection.update({
//         id: 1
//     }, {
//         shape: shape
//     })
//     console.log(shape)
//     res.send({
//         status: AJ_STATUS.success,
//         message: AJ_MESSAGE.success,
//         result: 111
//     })
// })

app.get('/aj/upload/token', async (req, res) => {
    var accessKey = AccessKey
    var secretKey = SecretKey
    var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    let id = uuid();
    const fileName = `${sha1(id)}.${req.query.fileName.split('.').pop()}`
    let bucketName = 'store'
    let returnBody
    switch (req.query.type) {
        case 'image':
            returnBody = '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(fname)", "imageInfo":$(imageInfo)}'
            break;
        case 'music':
            returnBody = '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","name":"$(fname)", "avinfo":$(avinfo)}'
            break;
    }
    var options = {
        scope: bucketName,
        // expires: 60 * 60 * 10,
        returnBody: returnBody
    };
    var putPolicy = new qiniu.rs.PutPolicy(options);
    var uploadToken = putPolicy.uploadToken(mac);
    // http://up-z2.qiniup.com
    res.send({
        token: uploadToken,
        key: fileName
    })
});
app.post('/aj/image/user_upload', async (req, res) => {
    let id = uuid();
    const collection = dbHandel.getModel('images')
    let lastData = await collection.find().sort({
        id: -1
    }).limit(1)
    if (req.body.imageInfo) {
        let createTime =
            await new collection({
                uid: req.session.uid,
                path: req.body.key,
                width: req.body.imageInfo.width,
                height: req.body.imageInfo.height,
                size: req.body.imageInfo.size,
                createTime: utils.getTime(),
                id: lastData[0].id + 1
            }).save();
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            data: {
                path: `http://p7d4z759a.bkt.clouddn.com/${req.body.key}`
            }
        })
    } else {
        //异常情况， 后缀为png,jpg等等，但是实际并不是图片
        res.send({
            status: AJ_STATUS.error,
            message: '不是图片',
            data: {}
        })
    }
})

app.post('/aj/music/user_upload', async (req, res) => {
    let id = uuid();
    const collection = dbHandel.getModel('musics')
    let lastData = await collection.find().sort({
        id: -1
    }).limit(1)
    if (req.body.avinfo && req.body.avinfo.audio) {
        let createTime =
            await new collection({
                uid: req.session.uid,
                path: req.body.key,
                createTime: utils.getTime(),
                id: lastData[0].id + 1,
                name: req.body.name
            }).save();
        res.send({
            status: AJ_STATUS.success,
            message: AJ_MESSAGE.success,
            data: {
                path: `http://p7d4z759a.bkt.clouddn.com/${req.body.key}`
            }
        })
    } else {
        //异常情况， 后缀为png,jpg等等，但是实际并不是图片
        res.send({
            status: AJ_STATUS.error,
            message: '不是音乐',
            result: {}
        })
    }
})

app.post('/aj/scene/update', async (req, res) => {
    const collection = dbHandel.getModel('myh5')
    let item = await collection.findOne({
        id: req.body.id
    })
    let title = req.body.title || item.title
    let desc = req.body.desc || item.desc
    let portrait = req.body.portrait || item.portrait
    portrait = portrait.match(/.com\/(.+)/)[1];
    await collection.update({
        id: req.body.id
    }, {
        title: title,
        desc: desc,
        portrait: portrait
    })
    res.send({
        status: AJ_STATUS.success,
        message: '更新成功',
        result: {}
    })
})
// app.get('/aj/bbb', async (req, res) => {
//   const collection = dbHandel.getModel('musics')
//   let count = await collection.count();
//   let time = 1525441262338;
//   for (let i = 0; i < count; i++) {
//     await collection.update({
//       id: 300000000 + i
//     }, {
//       createTime: time--
//     })
//   }
//   console.log('完事了');
//   res.send({
//     a: 10
//   })
// })
