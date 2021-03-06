function searchOnMap(event) {
    event.preventDefault();
    if (event.keyCode === 13) {
        location.href = '/map/#search/' + $('#search-on-map').val();
    }
}

function generateDoughnutChart(container, data) {
    var myChart = new Chart(container, {
        type: 'doughnut',
        data: data,
        options: {
            legend: {
                display: false
             },
            cutoutPercentage: 85,
            maintainAspectRatio: false
        }
    });
}

document.addEventListener('DOMContentLoaded', function (event) {
    var summaryData = JSON.parse(summaries);

    $.each(summaryData, function (className, classData) {
        var labels = [];
        var category_data= [];
        var background_color = [];

        $.each(classData, function (key, value) {
            if(key !== 'total') {
                category_data.push(value);
                if(key === 'indigenous') {
                    background_color.push('#ddd14e');
                    labels.push('Native');
                } else if(key === 'alien') {
                    background_color.push('#649b49');
                    labels.push('Non-Native');
                } else {
                    background_color.push('#3e5033');
                    labels.push('Translocated');
                }
            }
        });
        var config = {
            labels: labels,
            datasets: [{
                data: category_data,
                backgroundColor: background_color,
                borderColor: background_color,
                borderWidth: 1
            }]
        };
        var chartContainer = document.getElementById("chart-"+className);
        generateDoughnutChart(chartContainer, config);
    });
});
