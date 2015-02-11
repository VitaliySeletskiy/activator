define([
  './connection',
  'commons/format'
],function(
  connection,
  format
){

  function setListFilters(filters) {
    connection.filters.requests($.extend(connection.filters.requests(), filters));
  }
  var requestsList = ko.observable([]);

  connection.streams.requests
    .map(function(message) {
      if (message && message.data && message.data.playRequestSummaries)
        return message.data.playRequestSummaries;
    })
    .map(requestsList);


  connection.filters.requests({
    'name': 'requests',
    'scope': {},
    'sortCommand': 'startTime',
    'sortDirection': 'desc',
    'paging': { 'offset': 0, 'limit': 100 }
  });


  // Single request selected
  connection.streams.request
    .map(function(message) {
      if (message && message.data && message.data.playRequestSummary){
        currentRequest(message.data.playRequestSummary);
      }
    });

  var currentRequest = ko.observable();
  function setCurrentRequestId(id) {
    if (id){
      connection.filters.request({
        'name': 'request',
        'scope': {},
        'traceId': id
      });
    } else {
      connection.filters.request({});
    }
  }

  return {
    list: requestsList,
    currentRequest: currentRequest,
    setListFilters: setListFilters,
    setCurrentRequestId: setCurrentRequestId
  }

});
