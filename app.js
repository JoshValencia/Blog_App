//		DECLARING VARIABLES AND REQUIRING PACKAGES & MODULES		
//========================================================
require('dotenv').config()
const express 				= require('express'),
	  path 					= require('path'),
	  multer				= require('multer'),
	  flash                 = require('connect-flash'),
	  app 					= express(),
	  bodyParser 			= require('body-parser'),
	  mongoose 				= require('mongoose'),
	  passport 				= require('passport'),
	  LocalStrategy 		= require('passport-local'),
	  passportLocalMongoose = require('passport-local-mongoose'),
	  methodOverride 		= require('method-override'),
	  expressSanitizer 		= require('express-sanitizer'),
	  cloudinary            = require('cloudinary'), 
	  fs					= require('fs')

//					APP CONFIGURATIONS
//=============================================================

//<<<<<< --------MONGODB ATLAS CONNECTION FOR ONLINE DEPLOYMENT------>>>>>>>>>>>>>
mongoose.connect(process.env.MONGODB_URI||"localhost/restful_blog_app",{ 
	useNewUrlParser: true,
	useUnifiedTopology: true,
	useFindAndModify: false
});
//<<<<<< --------MONGODB ATLAS CONNECTION FOR ONLINE DEPLOYMENT------>>>>>>>>>>>>>

app.use(require('express-session')({
	secret: "Secret because it's secret",
	resave: false,
	saveUninitialized: false
}));

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressSanitizer());
app.use(flash());
app.use(methodOverride("_method"));
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req,res,next){
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

//								MONGOOSE MODELS
//==========================================================================
var seedDB = require('./models/seeds');

var Comments = require('./models/comments');

var Blog = require('./models/blog');

var User = require('./models/user');

// var Profile = require('./models/profile');

//SEEDING
// seedDB();


passport.use(new LocalStrategy(User.authenticate()));
//ENCODING SESSION
passport.serializeUser(User.serializeUser());
//DECODING SESSION
passport.deserializeUser(User.deserializeUser());


//							STORAGE ENGINE FOR FILES
//==========================================================================
var Storage = multer.diskStorage({
	filename:(req,file,cb)=>{
		cb(null,file.fieldname+"_"+Date.now()+path.extname(file.originalname));
	}
});

var upload = multer({
	storage:Storage
}).single('file');




//								RESTful Routes
//===========================================================================


app.get("/",function(req,res){
	res.redirect("/blogs");
});

//-------AUTHENTICATION ROUTES--------\\

//AUTHENTICATION FUNCTION
function isLoggedIn(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	req.flash("error","Please Sign-in or Create an account");
	res.redirect('/login');
}
//AUTHORIZATION FUNCTION=====================================================================
function checkProfileOwnerShip(req,res,next){
	if(req.user._id.equals(req.params.id)){
		return next();
	}else{
		req.flash("error","The Profile You are trying to access is not yours!");
		res.redirect('/blogs');
	}
};


function checkBlogOwnerShip(req,res,next){
	if(req.isAuthenticated()){
		Blog.findById(req.params.id,function(err,foundBlog){
			if(err){
				req.flash("error","Blogs not found");
				res.redirect('back');
			}else{
				if(foundBlog.author.id.equals(req.user._id)){
					next();
				}else{
					req.flash("error","You don't have a permission to do that!");
					res.redirect('back');
				};
			};
		});
	}else{
		req.flash("error","You need to be logged in to do that!");
		res.redirect('back')
	};
}

function checkCommentOwnerShip(req,res,next){
	if(req.isAuthenticated()){
		Comments.findById(req.params.comment_id,function(err,foundComments){
			if(err){
				res.redirect('/blogs/'+req.params.id);
			}else{
				if(foundComments.author.id.equals(req.user._id)){
					next();
				}else{
					req.flash("error","You don't have a permission to do that");
					res.redirect('/blogs/'+req.params.id);
				};
			};
		});
	}else{
		req.flash("error","Please Log-in to do that");
		res.redirect('/blogs/'+req.params.id);
	};
}

//REGEX FUNCTION
function escapeRegex(text){
	return text.replace(/[-[\]{}()*+?.,\\^$!#\s]/g, "\\$&");
};




//>>>REGISTRATION ROUTES<<<<\\============================================================
app.get("/register",function(req,res){
	res.render("register");
});

app.post("/register",upload,function(req,res){
	cloudinary.uploader.upload(req.file.path, function(result) {
		var username = req.body.username;
		var image = req.file.filename;
		var email =req.body.email;
		var fullname = req.body.fullname;
		var age = req.body.age;
		var location = req.body.location;
		var gender = req.body.gender;
		var bio = req.body.bio;
		image = result.secure_url;
		var newProfile = {username:username,image:image,email:email,fullname:fullname,age:age,location:location,gender:gender,bio:bio}
		User.register(new User(newProfile),req.body.password, function(err,user){
			if(err){
				console.log(err);
				req.flash("error", err.message);
				return res.render("register");
			}
			passport.authenticate('local')(req,res, function(){
					console.log(user)
					req.flash("success","Your Account has been Created Successfully! Welcome " + user.username);
					res.redirect('/blogs');
				});
			});
		});
	});
//>>>LOG-IN ROUTES<<<||

app.get('/login',function(req,res){
	res.render("login");
});

//middleware - login logic
app.post('/login',passport.authenticate('local',{
		successRedirect: "/blogs",
		failureRedirect: "/login"
	}),function(req,res){
});

//>>>LOG-OUT ROUTE<<<\\
app.get('/logout',function(req,res){
	req.logOut();
	req.flash("success", "You are Logged Out Successfully");
	res.redirect('/blogs');
})




//-------------------------------------\\

//===================PROFILE PAGE ROUTE===================\\

app.get('/profile/:id',isLoggedIn,checkProfileOwnerShip,function(req,res){
	User.findById(req.params.id, function(err, foundUser){
		if(err){
			req.flash("error", "Something went wrong!");
			res.redirect('/');
		}else{
			Blog.find().where('author.id').equals(foundUser._id).exec(function(err, blog){
			if(err){
				req.flash("error", "Something went wrong!");
				res.redirect('/');
			}else{
				res.render('profile', {blogs:blog})
			}
		})
	}
	})
});

app.get('/profile/view/:username',isLoggedIn,function(req,res){
	User.findById(req.params.username,function(err,user){
		if(err){
			req.flash("error", "Something went wrong!");
			res.redirect('/');
		}else{
			Blog.find().where('author.id').equals(user._id).exec(function(err, blog){
				if(err){
					req.flash("error", "Something went wrong!");
					res.redirect('/');
				}else{
					res.render('profilepage', {blogs:blog,user:user});
				}
			})
		}
	})
})





//================================SEARCH ROUTE=============================\\


app.get('/search',isLoggedIn,function(req,res){
	const regex = new RegExp(escapeRegex(req.query.search), 'gi');
	Blog.find({title: regex},function(err, allBlog){
		if(err){
			console.log(err);
		}else{
			User.find({fullname: regex},function(err, allUserFullname){
				if(err){
					console.log(err);
				}else{
					if(allBlog.length < 1&&allUserFullname.length<1){
						var noMatch = "No Match Found!"; 	
						res.render('search2',{match: noMatch});
					}else{
						res.render('search',{userfullname:allUserFullname,blogs:allBlog});
					}
				}
			})
		}
	});
});











//=============================MAIN ROUTES=============================\\

app.get("/blogs",function(req,res){
		Blog.find({},function(err,data){
		if(err){
			console.log("ERROR :" + err);
		}else{
		    res.render("index",{blogs:data});
		}
	});
});


app.get("/blogs/new",isLoggedIn, function(req,res){
	res.render("new");
})

app.post("/blogs",isLoggedIn,upload,function(req,res){
	cloudinary.uploader.upload(req.file.path, function(result) {
	var title = req.body.blog.title;
	var image = req.file.filename;
	var body = req.body.blog.body;
	var author = {
		id: req.user._id,
		username: req.user.username
	};
	body = req.sanitize(req.body.blog.body);
	image = result.secure_url;
	var imageId = req.body.blog.imageId;
	imageId = result.public_id;
	var newBlog = {title:title,image:image,imageId:imageId,body:body,author:author};
	Blog.create(newBlog,function(err,blogSend){
		if(err){
			res.render("new");
		}else{
			res.redirect('/blogs');
		}	
		});
	});
});


app.get('/blogs/:id',function(req,res){
	Blog.findById(req.params.id).populate("comments").exec(function(err,foundBlog){
		if(err){
			res.redirect('/blogs');
		}else{
			res.render("show",{blog:foundBlog});
		}
	})
})

app.get('/blogs/:id/edit',checkBlogOwnerShip,function(req,res){
		Blog.findById(req.params.id,function(err,foundBlog){
			if(err){
				req.flash("error", err)
			}else{
				res.render("edit",{blog:foundBlog});
			}
		});
})

app.put('/blogs/:id',checkBlogOwnerShip,upload,function(req,res){
	Blog.findById(req.params.id, async function(err,updatedBlog){
		if(err){
			res.redirect('/blogs');
		}else{
			if(req.file){
				try{
					await cloudinary.v2.uploader.destroy(updatedBlog.imageId);	
					var result = await cloudinary.v2.uploader.upload(req.file.path);
					updatedBlog.imageId = result.public_id;
					updatedBlog.image = result.secure_url;
				}catch(err){
					return res.redirect('/blogs');
				}
			}
			updatedBlog.title = req.body.blog.title;
			updatedBlog.body = req.body.blog.body;
			updatedBlog.save();
			res.redirect('/blogs/'+req.params.id);
				}
			});
		});

app.delete('/blogs/:id',checkBlogOwnerShip,function(req,res){
	Blog.findById(req.params.id, async function(err,updatedBlog){
		if(err){
			res.redirect('/blogs');
		}else{
			try{
				await cloudinary.v2.uploader.destroy(updatedBlog.imageId);	
				updatedBlog.remove();
				res.redirect('/blogs');
			}catch(err){
				res.redirect('/blogs');
			}
		}
	});
});

//COMMENTS ROUTE
app.post('/blogs/:id/comments/new',isLoggedIn,function(req,res){
	Blog.findById(req.params.id,function(err, blog){
		if(err){
			console.log(err);
			res.redirect('/blogs');
		}else{
			Comments.create(req.body.comment,function(err, comment){
				if(err){
					req.flash("error","Something went Wrong!");
					console.log(err);
				}else{
					comment.author.id = req.user._id;
					comment.author.username = req.user.username;
					comment.author.image = req.user.image;
					comment.save();
					blog.comments.push(comment);
					blog.save();
					req.flash("success","Successfully added a comment!");
					res.redirect('/blogs/' + blog._id);
				}
			});
		}
	});
});


//COMMENT UPDATE

app.get('/blogs/:id/comments/:comment_id/edit',checkCommentOwnerShip,function(req,res){
	Comments.findById(req.params.comment_id, function(err, foundComments){
		if(err){
			res.redirect('back');
		}else{
			res.render("commentEdit",{blog_id:req.params.id,comment: foundComments});
		};
	});
});

app.put('/blogs/:id/comments/:comment_id/edited',checkCommentOwnerShip,function(req,res){
	Comments.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
		if(err){
			res.redirect('/blogs/'+req.params.id);
		}else{
			res.redirect('/blogs/'+req.params.id);
		};
	});
});

app.delete('/blogs/:id/comments/:comment_id/delete',checkCommentOwnerShip,function(req,res){
	Comments.findByIdAndRemove(req.params.comment_id,function(err,theComment){
		if(err){
			res.redirect('/blogs/'+req.params.id);
		}else{
			req.flash("success","Comment has been deleted");
			res.redirect('/blogs/'+req.params.id);
		}
	});
});





//						SERVER INITIALIZE AND LISTEN
//====================================================================
//--------<<server initialization with heroku variable>>--------
const port = process.env.PORT || 3000;
app.listen(port,()=>{
    console.log('Server has started at PORT 3000');
});
//--------<<server initialization with heroku variable>>--------