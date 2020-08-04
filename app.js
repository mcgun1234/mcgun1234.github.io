let input_dataset = [];
let result = [];
let data_raw = [];
let sma_vec = [];
let window_size = 50;
let trainingsize = 70;
let data_temporal_resolutions = 'Weekly';

$(document).ready(function(){
  $('select').formSelect();
});


function onClickChangeDataFreq(freq){
  console.log(freq.value);
  data_temporal_resolutions = freq.value;
}

function onClickFetchData(){

  let ticker = document.getElementById("ticker").value;
  let apikey = "QX4XNIT3A04B3A2C";

  $("#btn_fetch_data").hide();
  $("#load_fetch_data").show();

  let requestUrl = "";
  if(data_temporal_resolutions == 'Daily'){
    requestUrl = "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol="+ticker+"&outputsize=full&apikey="+apikey;
  }else{
    requestUrl = "https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol="+ticker+"&apikey="+apikey;
  }

  $.getJSON(requestUrl
    ,function(data){
      // let data = gotten_data_raw;

      let message = "";
      $("#div_container_linegraph").show();

      let daily = [];
      if(data_temporal_resolutions == 'Daily'){
        daily = data['Time Series (Daily)'];
      }else{
        daily = data['Weekly Time Series'];
      }

      if(daily){
        let symbol = data['Meta Data']['2. Symbol'];
        let last_refreshed = data['Meta Data']['3. Last Refreshed'];

        data_raw = [];
        sma_vec = [];

        let index = 0;
        for(let date in daily){
          data_raw.push({ timestamp: date, price: parseFloat(daily[date]['4. close']) });
          index++;
        }

        data_raw.reverse();

        message = "Symbol: " + symbol + " (last refreshed " + last_refreshed + ")";

        $("#btn_fetch_data").show();
        $("#load_fetch_data").hide();
        $("#div_linegraph_data_title").text(message);

        if(data_raw.length > 0){
          let timestamps = data_raw.map(function (val) { return val['timestamp']; });
          let prices = data_raw.map(function (val) { return val['price']; });

          let graph_plot = document.getElementById('div_linegraph_data');
          Plotly.newPlot( graph_plot, [{ x: timestamps, y: prices, name: "Stocks Prices" }], { margin: { t: 0 } } );
        }

      }else{
        $("#div_linegraph_data").text( data['Information'] );
      }
	  onClickDisplaySMA();

    }
  );

}

function onClickDisplaySMA(){

  window_size = 20;

  sma_vec = ComputeSMA(data_raw, window_size);

  let sma = sma_vec.map(function (val) { return val['avg']; });
  let prices = data_raw.map(function (val) { return val['price']; });

  let timestamps_a = data_raw.map(function (val) { return val['timestamp']; });
  let timestamps_b = data_raw.map(function (val) {
    return val['timestamp'];
  }).splice(window_size, data_raw.length);

  let graph_plot = document.getElementById('div_linegraph_sma');
  Plotly.newPlot( graph_plot, [{ x: timestamps_a, y: prices, name: "Stock Price" }], { margin: { t: 0 } } );
  Plotly.plot( graph_plot, [{ x: timestamps_b, y: sma, name: "SMA" }], { margin: { t: 0 } } );

  onClickTrainModel();
}

function displayTrainingData(){
	onClickTrainModel();
}

async function onClickTrainModel(){

  let epoch_loss = [];

  let inputs = sma_vec.map(function(inp_f){
    return inp_f['set'].map(function(val) { return val['price']; })
  });
  let outputs = sma_vec.map(function(outp_f) { return outp_f['label']; });

  trainingsize = parseInt(80);
  let n_epochs = parseInt(5);
  let learningrate = parseFloat(0.01);
  let n_hiddenlayers = parseInt(4);

  inputs = inputs.slice(0, Math.floor(trainingsize / 100 * inputs.length));
  outputs = outputs.slice(0, Math.floor(trainingsize / 100 * outputs.length));

  let callback = function(epoch, log) {
	  console.log(log);
  };

  result = await trainModel(inputs, outputs, window_size, n_epochs, learningrate, n_hiddenlayers, callback);


	onClickValidate();
	onClickPredict();
}

function onClickValidate() {

  let inputs = sma_vec.map(function(inp_f) {
   return inp_f['set'].map(function (val) { return val['price']; });
  });

  // validate on training
  let val_train_x = inputs.slice(0, Math.floor(trainingsize / 100 * inputs.length));
  // let outputs = sma_vec.map(function(outp_f) { return outp_f['avg']; });
  // let outps = outputs.slice(0, Math.floor(trainingsize / 100 * inputs.length));
  console.log('val_train_x', val_train_x)
  let val_train_y = makePredictions(val_train_x, result['model']);
  console.log('val_train_y', val_train_y)

  // validate on unseen
  let val_unseen_x = inputs.slice(Math.floor(trainingsize / 100 * inputs.length), inputs.length);
  console.log('val_unseen_x', val_unseen_x)
  let val_unseen_y = makePredictions(val_unseen_x, result['model']);
  console.log('val_unseen_y', val_unseen_y)

  let timestamps_a = data_raw.map(function (val) { return val['timestamp']; });
  let timestamps_b = data_raw.map(function (val) {
    return val['timestamp'];
  }).splice(window_size, (data_raw.length - Math.floor((100-trainingsize) / 100 * data_raw.length))); 
	
  let timestamps_c = data_raw.map(function (val) {
    return val['timestamp'];
  }).splice(window_size + Math.floor(trainingsize / 100 * inputs.length), inputs.length);

  let sma = sma_vec.map(function (val) { return val['avg']; });
  let prices = data_raw.map(function (val) { return val['price']; });
  sma = sma.slice(0, Math.floor(trainingsize / 100 * sma.length));
  console.log('sma', sma)

  let graph_plot = document.getElementById('div_validation_graph');
  Plotly.newPlot( graph_plot, [{ x: timestamps_a, y: prices, name: "Actual Price" }], { margin: { t: 0 } } );
  Plotly.plot( graph_plot, [{ x: timestamps_b, y: sma, name: "Training Label (SMA)" }], { margin: { t: 0 } } );
  Plotly.plot( graph_plot, [{ x: timestamps_b, y: val_train_y, name: "Predicted (train)" }], { margin: { t: 0 } } );
  Plotly.plot( graph_plot, [{ x: timestamps_c, y: val_unseen_y, name: "Predicted (test)" }], { margin: { t: 0 } } );

}

async function onClickPredict() {

  let inputs = sma_vec.map(function(inp_f) {
   return inp_f['set'].map(function (val) { return val['price']; });
  });
  let pred_X = [inputs[inputs.length-1]];
  pred_X = pred_X.slice(Math.floor(trainingsize / 100 * pred_X.length), pred_X.length);
  let pred_y = makePredictions(pred_X, result['model']);

  window_size = 20;

  let timestamps_d = data_raw.map(function (val) {
    return val['timestamp'];
  }).splice((data_raw.length - window_size), data_raw.length);

  // date
  let last_date = new Date(timestamps_d[timestamps_d.length-1]);
  let add_days = 1;
  if(data_temporal_resolutions == 'Weekly'){
    add_days = 7;
  }
  last_date.setDate(last_date.getDate() + add_days);
  let next_date = await formatDate(last_date.toString());
  let timestamps_e = [next_date];

  let graph_plot = document.getElementById('div_prediction_graph');
  Plotly.newPlot( graph_plot, [{ x: timestamps_d, y: pred_X[0], name: "Latest Trends" }], { margin: { t: 0 } } );
  Plotly.plot( graph_plot, [{ x: timestamps_e, y: pred_y, name: "Predicted Price" }], { margin: { t: 0 } } );
	
}

function ComputeSMA(data, window_size)
{
  let r_avgs = [], avg_prev = 0;
  for (let i = 0; i <= data.length - window_size - 1; i++){
    let curr_avg = 0.00, t = i + window_size;
    for (let k = i; k < t && k <= data.length; k++){
      curr_avg += data[k]['price'] / window_size;
    }
    r_avgs.push({ set: data.slice(i, i + window_size), avg: curr_avg, label: data[i+window_size]['price'] });
    avg_prev = curr_avg;
  }
  return r_avgs;
}

function formatDate(date) {
  var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}
