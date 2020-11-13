import axios from "axios";

export default async function handler(req, res) {
  const { type, value } = req.query;

  let url = "";

  switch (type) {
    case "campgrounds":
      url = `${process.env.CAMPGROUNDS_URL}${value}`;
      break;
    case "campsites":
      url = `${process.env.CAMPSITES_URL}${value}`;
      break;
    case "availabilities":
      url = `${process.env.AVAILABILITIES_URL_1}${value}${process.env.AVAILABILITIES_URL_2}`;
      break;
    default:
      break;
  }

  res.json(await axios.get(url).then((response) => response.data));
}
