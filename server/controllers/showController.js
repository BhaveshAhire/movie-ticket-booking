import axios from 'axios';
import https from 'https';
import Movie from '../modals/Movie.js';
import { title } from 'process';
import Show from '../modals/Show.js';
import { inngest } from '../inngest/index.js';

// Create a custom HTTPS agent to avoid socket reuse issues
const agent = new https.Agent({ keepAlive: false });

// Helper function to retry Axios call
const fetchWithRetry = async (url, options, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { ...options, httpsAgent: agent });
      return response;
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise((res) => setTimeout(res, 1000)); // wait 1s before retry
    }
  }
};

export const getNowPlayingMovies = async (req, res) => {
  try {
    const url = 'https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1';
    const options = {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      },
      timeout: 10000, // optional but recommended
    };

    const { data } = await fetchWithRetry(url, options);
    res.json({ success: true, movies: data.results });
  } catch (error) {
    console.error("Final TMDB Error:", error?.response?.data || error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};


export const addShow = async (req, res) => {
  try {
    const {movieId,showsInput,showPrice} = req.body;

    let movie = await Movie.findById(movieId);
    if(!movie){
      const movieResponseUrl = `https://api.themoviedb.org/3/movie/${movieId}`;
      const cardsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits`
    const options = {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      },
      timeout: 10000, // optional but recommended
    };
      const [movieDetailsResponse,movieCreditsResponse] = await Promise.all([
         fetchWithRetry(movieResponseUrl, options),
         fetchWithRetry(cardsUrl, options)
      ]);

      

      const movieApiData = movieDetailsResponse.data;
      const movieCreditsData = movieCreditsResponse.data;

      const movieDetails = {
         _id: movieId,
         title: movieApiData.title,
         overview:movieApiData.overview,
         poster_path:movieApiData.poster_path,
         backdrop_path:movieApiData.backdrop_path,
         genres:movieApiData.genres,
         casts:movieCreditsData.cast,
         release_date:movieApiData.release_date,
         original_language:movieApiData.original_language,
         tagline:movieApiData.tagline || "",
         vote_average:movieApiData.vote_average,
         runtime:movieApiData.runtime,
      }
      movie = await Movie.create(movieDetails);
    }

    const showsTocreate = [];
    showsInput.forEach(show=>{
      const showDate = show.date;
      show.time.forEach((time)=>{
        const dateTimeString = `${showDate}T${time}`;
        showsTocreate.push({
          movie:movieId,
          showDateTime:new Date(dateTimeString),
          showPrice,
          occupiedSeats:{}
        })
      })
    });

    if(showsTocreate.length>0){
      await Show.insertMany(showsTocreate);
    }

    // Trigger Inngest event
    await inngest.send({
      name:"app/show.added",
      data:{movieTitle: movie.title,movieId: movie._id.toString()}
    })

  res.json({ success: true, message:'Show Added Successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get all show fron database
export const getShows = async(req,res) =>{
  try {
    const shows = await Show.find({showDateTime:{$gte: new Date()}}).populate('movie').sort({showDateTime:1});
    

    const uniqueShows = new Set(shows.map(show=>show.movie));
    console.log("UNIQUE",uniqueShows)

    res.json({success:true,shows:Array.from(uniqueShows)})
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// get single show
export const getShow = async(req,res)=>{
  try {
    const {movieId} = req.params;
    
    const shows = await Show.find({movie:movieId,showDateTime:{$gte: new Date()}});

    const movie = await Movie.findById(movieId);
   
    const dateTime = {};
    shows.forEach((show)=>{
      const date = show.showDateTime.toISOString().split("T")[0];
      if(!dateTime[date]){
        dateTime[date] = []
      }
      dateTime[date].push({time: show.showDateTime,showId: show._id});
    });
    res.json({success:true,movie,dateTime})
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}